import { socket } from './socket';

// Configuration for STUN servers
const configuration = {
    iceServers: [
        {
            urls: [
                "stun:stun.l.google.com:19302",
                "stun:stun1.l.google.com:19302",
                "stun:stun2.l.google.com:19302",
                "stun:stun3.l.google.com:19302",
                "stun:stun4.l.google.com:19302",
            ],
        },
    ],
    iceCandidatePoolSize: 10,
};

// Create peer connection with the configuration
export const peer = new RTCPeerConnection(configuration);

const createOffer = async (meetingId: string) => {
    try {
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        
        // Send the offer through socket
        socket.emit('send-offer', { meetingID: meetingId, offer });
        console.log('✅ Offer Sent:', offer);
    } catch (error) {
        console.error('❌ Error creating offer:', error);
    }
};

const createAnswer = async (meetingID: string, offer: RTCSessionDescriptionInit) => {
    try {
        console.log('📝 Creating answer for offer:', offer);
        
        // Set remote description with the received offer
        await peer.setRemoteDescription(new RTCSessionDescription(offer));

        // Create SDP Answer
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);

        // Send Answer to signaling server
        socket.emit("send-answer", { meetingID, answer });  
        console.log("✅ Answer Sent:", answer);
    } catch (error) {
        console.error("❌ Error creating answer:", error);
    }
};

// Add this function to set up all peer connection event handlers
const setupPeerConnectionHandlers = (meetingID: string) => {
    peer.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
        console.log("ICE Candidate Event:", event);
        if (event.candidate) {
            console.log("Sending ICE Candidate:", event.candidate);
            socket.emit("send-ice-candidate", { meetingID, candidate: event.candidate });
        }
    };

    peer.oniceconnectionstatechange = () => {
        console.log("ICE Connection State:", peer.iceConnectionState);
    };

    peer.onconnectionstatechange = () => {
        console.log("Connection State:", peer.connectionState);
    };

    peer.onnegotiationneeded = () => {
        console.log("Negotiation Needed");
    };
};

// Modify sendIceCandidate to use the setup function
const sendIceCandidate = (meetingID: string) => {
    console.log("Setting up ICE candidate handling");
    setupPeerConnectionHandlers(meetingID);
};

const receiveIceCandidate = (candidate: RTCIceCandidate) => {       
    console.log("Received ICE Candidate:", candidate);
    peer.addIceCandidate(candidate);
};

// Add this function to help debug the connection
export const logPeerStatus = () => {
    console.log({
        iceConnectionState: peer.iceConnectionState,
        connectionState: peer.connectionState,
        signalingState: peer.signalingState,
        iceGatheringState: peer.iceGatheringState
    });
};

// Export the setup function so it can be called early
export { createOffer, createAnswer, sendIceCandidate, receiveIceCandidate, setupPeerConnectionHandlers };