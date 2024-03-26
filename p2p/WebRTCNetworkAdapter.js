import {cbor as cborHelpers, NetworkAdapter} from "@automerge/automerge-repo"

const { encode, decode } = cborHelpers

export class WebRTCNetworkAdapter extends NetworkAdapter {
	constructor(connection, channel, options) {
		super()
		this.connection = connection;
		this.channel = channel;
		this.options = options;
		setInterval(() => {
			this.send({'type': 'ping'});
		}, 1000);

	}

	connect(peerId, peerMetaData) {
		this.peerId = peerId;
		this.peerMetadata = peerMetaData;
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
						const data = message.data
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

		this.emit("ready", { network: this })

		this.channel.onclose = (e) => {
			console.log(e);
		}
	}

	announceConnection(peerId, peerMetadata) {
		this.emit("peer-candidate", { peerId, peerMetadata })
	}

	send(message) {
		let payload;
		if ("data" in message) {
			payload = {
				...message,
				data: Array.from(message.data)
			}
		} else {
			payload = message;
		}
		console.log("Sending", payload);
		const encoded = encode(payload);
		console.log("Encoded", encoded);
		console.log("Size", encoded.byteLength / 1024)
		const arrayBuf = this.toArrayBuffer(encoded);
		this.channel.send(arrayBuf);
	}

	toArrayBuffer(bytes) {
		const { buffer, byteOffset, byteLength } = bytes
		return buffer.slice(byteOffset, byteOffset + byteLength)
	}

	disconnect() {

	}
}
