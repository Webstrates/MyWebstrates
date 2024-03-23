import {NetworkAdapter} from "@automerge/automerge-repo"

export class WebRTCNetworkAdapter extends NetworkAdapter {
	constructor(channel, options) {
		super()
		this.channel = channel;
		this.options = options;
	}

	connect(peerId, peerMetaData) {
		this.peerId = peerId;
		this.peerMetadata = peerMetaData;
		this.channel.onmessage = (e) => {
			const message = JSON.parse(e.data);

			if ("targetId" in message && message.targetId !== this.peerId) {
				return
			}

			const {senderId, type} = message

			switch (type) {
				case "arrive": {
					const {peerMetadata} = message
					this.channel.send(JSON.stringify({
						senderId: this.peerId,
						targetId: senderId,
						type: "welcome",
						peerMetadata: this.peerMetadata,
					}))
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

		let payload = JSON.stringify({
			senderId: this.peerId,
			type: "arrive",
			peerMetaData,
		});
		this.channel.send(payload)

		this.emit("ready", { network: this })

		this.channel.onclose = (e) => {
			console.log(e);
		}
	}

	announceConnection(peerId, peerMetadata) {
		this.emit("peer-candidate", { peerId, peerMetadata })
	}

	send(message) {
		if ("data" in message) {
			let payload = {
				...message,
				data: Array.from(message.data)
			}
			this.channel.send(JSON.stringify(payload))
		} else {
			this.channel.send(message)
		}
	}

	disconnect() {

	}
}
