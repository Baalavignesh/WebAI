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

    // Setup video stream first
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // Add tracks to the peer connection
          stream.getTracks().forEach((track) => {
            peer.addTrack(track, stream);
          });
        }
      })
      .catch((err) => console.error("Error accessing media devices:", err));

    // Add peer connection track handler
    peer.ontrack = (event) => {
      console.log("🎥 Remote track received:", event.streams[0]);
      if (!remoteVideoRef.current) {
        console.error("Remote video element not found!");
        return;
      }
      
      try {
        remoteVideoRef.current.srcObject = event.streams[0];
        console.log("Remote video stream set successfully");
        
        // Add event listeners to verify video is playing
        remoteVideoRef.current.onloadedmetadata = () => {
          console.log("Remote video metadata loaded");
          remoteVideoRef.current?.play()
            .then(() => console.log("Remote video playing"))
            .catch(err => console.error("Error playing remote video:", err));
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
    });

    socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
    });

    const initializeConnection = async () => {
      const response: any = await GetMeetingID(meetingId);
      const data = JSON.parse(response.meetingRoom);

      console.log("Meeting data:", data, "Host in browser:", hostNameInBrowser);
      setHost(data.name);

      if (data.name === hostNameInBrowser && !offer) {
        createOffer(meetingId);
      }
    };

    initializeConnection();

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
    //   console.log("📨 ICE Candidate Received:", data.candidate);
      receiveIceCandidate(data.candidate);
    });

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

  const remoteVideoRef = useRef<HTMLVideoElement>(null);

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
  
        {/* Remote video */}
        <div className="relative">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full rounded-lg shadow-lg bg-gray-800"
          />
          <div className="absolute bottom-4 left-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded-lg">
            Remote User
          </div>
        </div>
      </div>
    </div>
  );

};

export default MeetingPage;
