import "./qrcode.js";
import {Html5QrcodeScanner} from "html5-qrcode";
import { next as Automerge } from "@automerge/automerge"
import { Repo, isValidAutomergeUrl } from "@automerge/automerge-repo"
import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb"
import { MessageChannelNetworkAdapter } from "@automerge/automerge-repo-network-messagechannel"
import {WebRTCNetworkAdapter} from "./WebRTCNetworkAdapter";

await import("es-module-shims")

let connection;
const messageChannel = new MessageChannel()
let repo = new Repo({
	storage: new IndexedDBStorageAdapter(),
	network: [new MessageChannelNetworkAdapter(messageChannel.port1)],
	peerId: "p2p-" + Math.round(Math.random() * 1000000),
	sharePolicy: async (peerId) => true,
});
navigator.serviceWorker.controller.postMessage({ type: "INIT_PORT" }, [messageChannel.port2])
window.repo = repo;

function createChallenge(){
	connection = new RTCPeerConnection({
		iceServers: [],
		iceTransportPolicy: "all",
	});
	let channel = connection.createDataChannel("test");
	channel.onopen = ()=>{
		document.getElementById("output").innerText = "Connection established";
		const adapter = new WebRTCNetworkAdapter(connection, channel);
		repo.networkSubsystem.addNetworkAdapter(adapter);
	};
	channel.onclose = ()=>{
		console.log("Connection closed")
		document.getElementById("output").innerText = "Channel closed";
	};
	channel.onerror = (e)=>{
		console.log("Error",e);
		document.getElementById("output").innerText = "Error: "+e;
	};

	// Arbitrary limitation: Generate an offer 1s after the first candidate resolves
	// TODO: Timeout otherwise
	let waitingForFirstCandidate = true;
	return new Promise((resolve, reject)=>{
		connection.onicecandidate = (e) => {
			if (waitingForFirstCandidate){
				waitingForFirstCandidate = false;
				setTimeout(async ()=>{
					resolve(await connection.createOffer());
				},1000);
			}
		}
		connection.onicegatheringstatechange = (e)=>{
			console.log("State change",e);
		}
		connection.onicecandidateerror = ()=>{
			console.log("Candidate error");
		}

		// Create initial offer without ICE trickled candidates
		let offer = connection.createOffer();
		offer.then(()=>{
			connection.setLocalDescription(offer)
		});
	})
}

function createResponse(sdp){
	connection = new RTCPeerConnection();
	connection.ondatachannel = (event) => {
		let establishedChannel = event.channel;
		establishedChannel.onopen = ()=>{
			document.getElementById("output").innerText = "Connection established";
			const adapter = new WebRTCNetworkAdapter(connection, establishedChannel);
			repo.networkSubsystem.addNetworkAdapter(adapter);
		};
		establishedChannel.onclose = ()=>{
			console.log("RX closed");
			document.getElementById("output").innerText = "Channel closed";
		};
	};

	// Arbitrary limitation: Generate an answer 1s after the first candidate resolves
	// TODO: Timeout otherwise
	let waitingForFirstCandidate = true;
	return new Promise((resolve, reject)=>{
		connection.onicecandidate = (e) => {
			if (waitingForFirstCandidate){
				waitingForFirstCandidate = false;
				setTimeout(async ()=>{
					resolve(connection.localDescription);
				},1000);
			}
		}
		connection.onicegatheringstatechange = (e)=>{
			console.log("State change",e);
		}
		connection.onicecandidateerror = ()=>{
			console.log("Candidate error");
		}

		// Create initial answer without ICE trickled candidates
		connection.setRemoteDescription(new RTCSessionDescription(sdp)).then(()=>{
			let answer = connection.createAnswer();
			answer.then(()=>{
				connection.setLocalDescription(answer);
			});
		})
	})
}

function processResponse(sdp){
	// Attempt to establish the actual connection using the candidates in the response answer
	connection.setRemoteDescription(new RTCSessionDescription(sdp)).then(()=>{
		console.log("Connecting...");
	})
}


// embedded: await WPMv2.require([{package: "qrcodejs", repository: "wpm_js_libs"}]);
document.getElementById("challenge").addEventListener("click",async ()=>{
	let target = document.getElementById("qr-challenge");
	let code = await createChallenge();
	await navigator.clipboard.writeText(code.sdp);
	new QRCode(target, {
		text: code.sdp,
		width: 2600,
		height: 2600,
		colorDark: "#005500",
		colorLight: "#ffffff",
		correctLevel: QRCode.CorrectLevel.L
	});
	target.onclick = ()=>{
		target.innerHTML = "";
		target.onclick = undefined;
	}
})

// ------------------- Sender
document.getElementById("response-input").addEventListener("click", async ()=>{
	let e = prompt();
	processResponse({type:"answer", sdp:e+"\n"});
});
document.getElementById("response").addEventListener("click", async ()=>{
	async function onScanSuccess(decodedText, decodedResult) {
		html5QrcodeScanner.clear();

		processResponse({type:"offer",sdp:decodedText});
	}

	function onScanFailure(error) {
		// handle scan failure, usually better to ignore and keep scanning.
		// for example:
		console.warn(`Code scan error = ${error}`);
	}

	let html5QrcodeScanner = new Html5QrcodeScanner(
		"scan-response",
		{ fps: 10, qrbox: {width: 250, height: 250} },
		/* verbose= */ false);
	html5QrcodeScanner.render(onScanSuccess, onScanFailure);
})


// Receiver
document.getElementById("receiver").addEventListener("click", async ()=>{
	async function onScanSuccess(decodedText, decodedResult) {
		html5QrcodeScanner.clear();

		let target = document.getElementById("qr-response");
		let code = await createResponse({type:"offer",sdp:decodedText});
		await navigator.clipboard.writeText(code.sdp);
		document.getElementById("output").innerText = code.sdp;
		new QRCode(target, {
			text: code.sdp,
			width: 2600,
			height: 2600,
			colorDark: "#000055",
			colorLight: "#ffffff",
			correctLevel: QRCode.CorrectLevel.L
		});
		target.onclick = ()=>{
			target.innerHTML = "";
			target.onclick = undefined;
		}
	}

	function onScanFailure(error) {
		// handle scan failure, usually better to ignore and keep scanning.
		// for example:
		console.warn(`Code scan error = ${error}`);
		document.getElementById("output").innerText = error;
	}

	let html5QrcodeScanner = new Html5QrcodeScanner(
		"scan-challenge",
		{ fps: 10, qrbox: {width: 250, height: 250} },
		/* verbose= */ false);
	html5QrcodeScanner.render(onScanSuccess, onScanFailure);
})

document.getElementById("receiver-input").addEventListener("click", async ()=>{
	let e = prompt();
	let target = document.getElementById("qr-response");
	let code = await createResponse({type:"offer", sdp:e+"\n"});
	await navigator.clipboard.writeText(code.sdp);
	console.log("Challenge:", code);
	new QRCode(target, {
		text: code.sdp,
		width: 2600,
		height: 2600,
		colorDark: "#000055",
		colorLight: "#ffffff",
		correctLevel: QRCode.CorrectLevel.L
	});
	target.onclick = ()=>{
		target.innerHTML = "";
		target.onclick = undefined;
	}
});
