import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import {
  createAnswer,
  createOffer,
  receiveIceCandidate,
  peer,
  handleAnswer,
} from "../services/sdp";
import { connectSocket, disconnectSocket, socket } from "../services/socket";
import { GetMeetingID } from "../services/meeting";
import { transcribeService } from "../services/transcribe";

const MeetingPage: React.FC = () => {
  const navigate = useNavigate();
  const { meetingId } = useParams<{ meetingId: string }>();
  const [host, setHost] = useState<string>("");
  const [offer, setOffer] = useState<RTCSessionDescriptionInit | null>(null);
  const [transcripts, setTranscripts] = useState<string[]>([]);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [peerConnected, setPeerConnected] = useState<boolean>(false);
  const [participants, setParticipants] = useState<string[]>([]);
  const reconnectTimerRef = useRef<number | null>(null);
  const isHost = useRef<boolean>(false);

  const hostNameInBrowser = localStorage.getItem("host");

  const videoRef = useRef<HTMLVideoElement>(null);

  // Function to handle transcription toggle
  const toggleTranscription = async () => {
    if (isTranscribing) {
      // Stop transcription
      await transcribeService.stopTranscription();
      setIsTranscribing(false);
    } else {
      // Start transcription
      const success = await transcribeService.startTranscription(
        new MediaStream(), // Web Speech API doesn't need the media stream
        (transcript) => {
          setTranscripts((prev) => [...prev, transcript]);
        }
      );
      setIsTranscribing(success);
    }
  };

  // Initialize or reinitialize the connection
  const initializeConnection = async (meetingId: string) => {
    try {
      const response: any = await GetMeetingID(meetingId);
      const data = JSON.parse(response.meetingRoom);

      console.log("Meeting data:", data, "Host in browser:", hostNameInBrowser);
      setHost(data.name);
      
      // Determine if current user is the host
      isHost.current = data.name === hostNameInBrowser;
      
      // If we're the host, create an offer
      if (isHost.current) {
        console.log("I am the host, creating offer");
        createOffer(meetingId);
      } else {
        console.log("I am not the host, waiting for offer");
      }
    } catch (error) {
      console.error("Error initializing connection:", error);
    }
  };

  // const createEphermeralToken = async () => {
  //   const r = await fetch("http://localhost:3000/api/openai/session");
  //   const data = await r.json();
  //   console.log("Ephermeral token:", data.client_secret.value);
  //   store.dispatch(setEphermeralToken(data.client_secret.value));
  // };

  // Handle reconnection attempts
  const handleReconnection = () => {
    // Only the host initiates reconnection with a new offer
    if (isHost.current) {
      console.log("Host attempting to reconnect...");
      
      // Clear any existing reconnection timer
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      
      // Set a timer to recreate the offer if not connected
      reconnectTimerRef.current = setTimeout(() => {
        if (!peerConnected && socket.connected && meetingId) {
          console.log("Creating new offer after connection loss");
          
          // Reset peer connection before creating a new offer
          if (peer.connectionState === 'failed' || peer.connectionState === 'closed') {
            console.log("Resetting peer connection before new offer");
            // We'll reuse existing stream when recreating the offer
            const existingStream = videoRef.current?.srcObject as MediaStream;
            if (existingStream) {
              createOffer(meetingId);
            }
          } else if (peer.connectionState === 'disconnected') {
            // Just try one more offer if disconnected
            createOffer(meetingId);
          }
          
        }
      }, 5000); // First retry after 5 seconds
    }
  };

  // Monitor peer connection state changes
  useEffect(() => {
    if (!peer) return;
    
    const handleConnectionChange = () => {
      console.log("Peer connection state:", peer.connectionState);
      if (peer.connectionState === 'connected') {
        setPeerConnected(true);
        
        // Clear reconnection timer if we're connected
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }
      } else if (peer.connectionState === 'disconnected' || 
                peer.connectionState === 'failed' || 
                peer.connectionState === 'closed') {
        setPeerConnected(false);
        
        // Start reconnection process if connection is lost
        handleReconnection();
      }
    };
    
    peer.addEventListener('connectionstatechange', handleConnectionChange);
    
    return () => {
      peer.removeEventListener('connectionstatechange', handleConnectionChange);
      
      // Clear reconnection timer on cleanup
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
    };
  }, [meetingId]);

  useEffect(() => {
    if (!meetingId) {
      navigate("/");
      return;
    }

    setPeerConnected(false);
    setParticipants([]);

    // Setup video stream first
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        console.log("Got local media stream:", stream);
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          
          // Clear existing tracks before adding new ones
          const senders = peer.getSenders();
          senders.forEach(sender => {
            peer.removeTrack(sender);
          });
          
          // Add tracks to the peer connection
          stream.getTracks().forEach((track) => {
            console.log(`Adding track to peer: ${track.kind}`);
            peer.addTrack(track, stream);
          });
          
          // Manually check if the local video is playing
          videoRef.current.onloadedmetadata = () => {
            console.log("Local video metadata loaded");
            videoRef.current?.play()
              .then(() => console.log("Local video playing"))
              .catch(err => console.error("Error playing local video:", err));
          };
        }
      })
      .catch((err) => console.error("Error accessing media devices:", err));

    // Add peer connection track handler
    peer.ontrack = (event) => {
      console.log("🎥 Remote track received:", event.streams[0]);
      
      // Print track details
      event.streams[0].getTracks().forEach(track => {
        console.log(`Remote track: ${track.kind}, enabled: ${track.enabled}, readyState: ${track.readyState}`);
      });
      
      if (!remoteVideoRef.current) {
        console.error("Remote video element not found!");
        return;
      }

      try {
        // Store the remote stream and force a UI update by setting state
        remoteVideoRef.current.srcObject = event.streams[0];
        console.log("Remote video stream set successfully");
        
        // Set a state to force re-render which helps update the video
        setPeerConnected(true);

        // Add event listeners to verify video is playing
        remoteVideoRef.current.onloadedmetadata = () => {
          console.log("Remote video metadata loaded");
          remoteVideoRef.current
            ?.play()
            .then(() => console.log("Remote video playing"))
            .catch((err) => console.error("Error playing remote video:", err));
        };

        remoteVideoRef.current.onerror = (e) => {
          console.error("Remote video error:", e);
        };
      } catch (error) {
        console.error("Error setting remote stream:", error);
      }
    };

    // Add debug logs for socket connection
    console.log("Attempting to connect socket...");
    connectSocket();
    console.log("Socket connection initiated");

    socket.on("connect", () => {
      console.log("Socket connected successfully with ID:", socket.id);
      socket.emit("join-meeting", meetingId);
      console.log("Joined meeting room:", meetingId);
      
      // Initialize connection after socket is connected
      initializeConnection(meetingId);
    });

    socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
    });

    // Track who's in the meeting
    socket.on("user-joined", (userData) => {
      console.log("User joined the meeting:", userData);
      
      // Add to participants list if not already there
      setParticipants(prev => {
        if (prev.includes(userData.id)) {
          return prev;
        }
        return [...prev, userData.id];
      });
      
      // If we're the host and someone new joined, send an offer
      // But only if we're not already connected to avoid redundant offers
      if (isHost.current && !peerConnected) {
        console.log("Host sending offer to newly joined user");
        // Add slight delay to ensure the other side is ready to receive the offer
        setTimeout(() => {
          createOffer(meetingId);
        }, 1000);
      }
    });
    
    socket.on("user-left", (userData) => {
      console.log("User left the meeting:", userData);
      setParticipants(prev => prev.filter(id => id !== userData.id));
      
      // If peer was connected and the remote user left, update the connection state
      if (peerConnected && remoteVideoRef.current?.srcObject) {
        console.log("Remote user left, resetting connection state");
        setPeerConnected(false);
        // Clear the remote video
        if (remoteVideoRef.current) {
          const stream = remoteVideoRef.current.srcObject as MediaStream;
          if (stream) {
            stream.getTracks().forEach(track => track.stop());
          }
          remoteVideoRef.current.srcObject = null;
        }
      }
    });

    // Setup socket listeners
    socket.on("receive-offer", (data) => {
      console.log("📨 Offer Received:", data.offer);
      if (data.offer) {
        setOffer(data.offer);
        createAnswer(meetingId, data.offer);
      }
    });

    socket.on("receive-answer", async (data) => {
      console.log("📨 Answer Received:", data.answer);
      await handleAnswer(data.answer);
    });

    socket.on("receive-ice-candidate", (data) => {
      console.log("📨 ICE Candidate Received:", data.candidate);
      receiveIceCandidate(data.candidate);
    });

    // Cleanup
    return () => {
      // Stop transcription if active
      if (isTranscribing) {
        transcribeService.stopTranscription();
      }
      
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach((track) => track.stop());
      }
      
      // Clear any reconnection timers
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      
      socket.emit("leave-meeting", meetingId);
      socket.off("receive-offer");
      socket.off("receive-answer");
      socket.off("receive-ice-candidate");
      socket.off("user-joined");
      socket.off("user-left");
      disconnectSocket();
    };
  }, [meetingId]);

  const remoteVideoRef = useRef<HTMLVideoElement>(null);


  return (
    <div className="h-screen bg-custom-white p-8 overflow-y-auto">
      <h1 className="text-3xl font-bold mb-6">Meeting - {meetingId}</h1>
      <div className="grid grid-cols-2 gap-4">
        {/* Local video */}
        <div className="relative">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full rounded-lg shadow-lg"
          />
          <div className="absolute bottom-4 left-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded-lg">
            You {isHost.current ? "(Host)" : ""}
          </div>
        </div>

        {/* Remote video */}
        <div className="relative">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full rounded-lg shadow-lg bg-gray-800"
            onPlay={() => console.log("Remote video started playing")}
          />
          <div className="absolute bottom-4 left-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded-lg">
            Remote User
          </div>
          {!remoteVideoRef.current?.srcObject && (
            <div className="absolute inset-0 flex items-center justify-center text-white bg-black bg-opacity-50">
              Waiting for remote user...
            </div>
          )}
        </div>
      </div>
      
      {/* Connection Status */}
      <div className="mt-4 mb-2 flex items-center">
        <span className={`inline-block px-3 py-1 rounded-full text-sm ${peerConnected ? 'bg-green-500' : 'bg-red-500'} text-white`}>
          {peerConnected ? 'Connected to peer' : 'Not connected to peer'}
        </span>
        <span className="ml-2 text-sm text-gray-600">
          {participants.length} participant(s) in the meeting
        </span>
      </div>
      
      {/* Transcription Area */}
      <div className="mt-2">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-xl font-semibold">Live Transcription</h2>
          {
            isHost.current && (
              <button 
                onClick={toggleTranscription}
            className={`px-4 py-2 rounded-lg ${isTranscribing ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'} text-white`}
          >
                {isTranscribing ? 'Stop Transcription' : 'Start Transcription'}
              </button>
            )
          }
        </div>
        <div className="bg-gray-100 p-4 rounded-lg h-48 overflow-y-auto">
          {transcripts.length > 0 ? (
            transcripts.map((text, index) => (
              <p key={index} className="mb-2">{text}</p>
            ))
          ) : (
            <p className="text-gray-500">Transcription will appear here...</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default MeetingPage;
