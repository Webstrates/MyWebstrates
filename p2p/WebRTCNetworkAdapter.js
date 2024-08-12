import {cbor as cborHelpers, NetworkAdapter} from "@automerge/automerge-repo/slim"

const { encode, decode } = cborHelpers

export class WebRTCNetworkAdapter extends NetworkAdapter {
	constructor(connection, channel, options) {
		super()
		this.connection = connection;
		this.channel = channel;
		this.options = options;
		this.chunkMap = new Map();
		this.ready = false;
		this.readyResolver = () => {};
		this.readyPromise = new Promise(resolve => {
			this.readyResolver = resolve
		});

		setInterval(() => {
			this.send({'type': 'ping'});
		}, 1000);

	}

	whenReady() {
		return this.readyPromise;
	}

	connect(peerId, peerMetaData) {
		this.peerId = peerId;
		this.peerMetadata = peerMetaData;
		this.ready = true;

		this.channel.onmessage = (e) => {
			const message = decode(new Uint8Array(e.data));
			console.log("Got message", message);

			if ("targetId" in message && message.targetId !== this.peerId) {
				return
			}

			const {senderId, type} = message

			switch (type) {
				case "arrive": {
					const {peerMetadata} = message
					this.send({
						senderId: this.peerId,
						targetId: senderId,
						type: "welcome",
						peerMetadata: this.peerMetadata,
					})
					this.announceConnection(senderId, peerMetadata)
				}
					break
				case "welcome": {
					const {peerMetadata} = message
					this.announceConnection(senderId, peerMetadata)
				}
					break
				default:
					if (!("data" in message)) {
						this.emit("message", message)
					} else {
						let data = message.data
						if (message.chunked) {
							if (!this.chunkMap.has(message.chunked.id)) {
								this.chunkMap.set(message.chunked.id, {chunks: new Array(message.chunked.total), received: 1})
							} else {
								this.chunkMap.get(message.chunked.id).received++;
							}
							this.chunkMap.get(message.chunked.id).chunks[message.chunked.index] = data;
							if (this.chunkMap.get(message.chunked.id).received === message.chunked.total) {
								let consolidatedData = [];
								for (let chunk of this.chunkMap.get(message.chunked.id).chunks) {
									chunk.forEach(c => consolidatedData.push(c));
								}
								data = consolidatedData;
								this.chunkMap.delete(message.chunked.id);
								delete message.chunked;
							} else {
								return;
							}
						}
						console.log("Got message", message);
						this.emit("message", {
							...message,
							data: new Uint8Array(data),
						})
					}
					break
			}
		}

		let payload = {
			senderId: this.peerId,
			type: "arrive",
			peerMetaData,
		};
		this.send(payload)

		this.channel.onclose = (e) => {
			console.log(e);
		}
	}

	announceConnection(peerId, peerMetadata) {
		this.forceReady();
		this.emit("peer-candidate", { peerId, peerMetadata })
	}

	forceReady() {
		if (!this.ready) {
			this.ready = true;
			if (this.readyResolver) this.readyResolver()
		}
	}

	isReady() {
		return this.ready;
	}

	send(message) {
		console.log("Sending message", message)
		let payloads = [];
		if ("data" in message) {
			let dataArray = Array.from(message.data);
			if (dataArray.length > 10*1024) { // 10KB
				console.log("Message over 10kb, chunking");
				// We give it a pseudo-random ID to avoid collisions
				const timestamp = Date.now();
				const randomComponent = Math.random().toString(36).substring(2, 15);
				const id = `${timestamp}-${randomComponent}`;
				// 10KB chunks
				let chunkSize = 10*1024;
				let chunks = Math.floor(dataArray.length / chunkSize);
				let lastChunkSize = dataArray.length % chunkSize;
				let chunkCount = lastChunkSize > 0 ? chunks + 1 : chunks;
				for (let i = 0; i < chunks; i++) {
					let start = i * chunkSize;
					let end = start + chunkSize;
					let chunk = dataArray.slice(start, end);
					payloads.push({
						...message,
						data: chunk,
						chunked: {
							index: i,
							total: chunkCount,
							id: id
						}
					});
				}
				if (lastChunkSize > 0) {
					let start = chunks * chunkSize;
					let end = start + lastChunkSize;
					let chunk = dataArray.slice(start, end);
					payloads.push({
						...message,
						data: chunk,
						chunked: {
							index: chunks,
							total: chunkCount,
							id: id
						}
					});
				}
			} else {
				payloads.push({
					...message,
					data: message.data
				});
			}
		} else {
			payloads.push(message);
		}
		for (let payload of payloads) {
			const encoded = encode(payload);
			const arrayBuf = this.toArrayBuffer(encoded);
			this.channel.send(arrayBuf);
		}
	}

	toArrayBuffer(bytes) {
		const { buffer, byteOffset, byteLength } = bytes
		return buffer.slice(byteOffset, byteOffset + byteLength)
	}

	disconnect() {
		if (this.connection) this.connection.disconnect();
		this.ready = false;
	}
}
