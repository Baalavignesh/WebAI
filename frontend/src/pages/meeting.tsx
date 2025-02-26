import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { createAnswer, createOffer, receiveIceCandidate, sendIceCandidate, logPeerStatus } from "../services/sdp";
import { connectSocket, disconnectSocket, socket } from "../services/socket";
import { GetMeetingID } from "../services/meeting";

const MeetingPage: React.FC = () => {
  const navigate = useNavigate();
  const { meetingId } = useParams<{ meetingId: string }>();
  const [host, setHost] = useState<string>("");
  const [offer, setOffer] = useState<RTCSessionDescriptionInit | null>(null);

  const hostNameInBrowser = localStorage.getItem("host");

  const videoRef = useRef<HTMLVideoElement>(null);


  useEffect(() => {
    if (!meetingId) {
      navigate("/");
      return;
    }

    // Add debug logs for socket connection
    console.log("Attempting to connect socket...");
    connectSocket();
    console.log("Socket connection initiated");
    
    socket.on("connect", () => {
      console.log("Socket connected successfully with ID:", socket.id);
      socket.emit("join-meeting", meetingId);
      console.log("Joined meeting room:", meetingId);
    });

    socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
    });

    const initializeConnection = async () => {
      const response:any = await GetMeetingID(meetingId);
      const data = JSON.parse(response.meetingRoom);
      
      console.log('Meeting data:', data, 'Host in browser:', hostNameInBrowser);
      setHost(data.name);
      
      // Only create offer if we're the host and haven't created one yet
      if (data.name === hostNameInBrowser && !offer) {
        console.log("Creating offer as host");
        createOffer(meetingId);
      }
    };

    initializeConnection();

    // Setup socket listeners first
    socket.on("receive-offer", (data) => {
      console.log("📨 Offer Received:", data.offer);
      if (data.offer) {
        setOffer(data.offer);
        createAnswer(meetingId, data.offer);
      }
    });

    socket.on("receive-answer", (data) => {
      console.log("📨 Answer Received:", data.answer);
      // Start ICE candidate exchange after answer is received
      sendIceCandidate(meetingId);
      // Log peer connection status
      logPeerStatus();
    });

    socket.on("receive-ice-candidate", (data) => {
      console.log("📨 ICE Candidate Received:", data.candidate);
      receiveIceCandidate(data.candidate);
      // Log peer connection status after receiving candidate
      logPeerStatus();
    });
    

    // Setup video stream
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch((err) => console.error("Error accessing media devices:", err));

    // Cleanup
    return () => {
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach((track) => track.stop());
      }
      socket.emit("leave-meeting", meetingId);
      socket.off("receive-offer");
      socket.off("receive-answer");
      socket.off("receive-ice-candidate");
      disconnectSocket();
    };
  }, [meetingId, hostNameInBrowser]);

  return (
    <div className="h-screen bg-custom-white p-8">
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
            You
          </div>
        </div>
        {/* Remote video will appear here when connected */}
        <div className="relative bg-gray-100 rounded-lg flex items-center justify-center min-h-[300px]">
          <p className="text-gray-500">Waiting for others to join...</p>
        </div>
      </div>
    </div>
  );
};

export default MeetingPage;
