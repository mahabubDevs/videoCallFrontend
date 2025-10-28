import React, { useRef, useState, useEffect } from "react";
import { io } from "socket.io-client";

const socket = io("http://localhost:5004");

function App() {
  const [roomId, setRoomId] = useState("");
  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const pc = useRef(new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  }));

  let otherUserId = useRef(null);

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        localVideoRef.current.srcObject = stream;
        stream.getTracks().forEach(track => pc.current.addTrack(track, stream));
      })
      .catch(err => alert("Camera/microphone not found: " + err));

    pc.current.ontrack = (event) => {
      remoteVideoRef.current.srcObject = event.streams[0];
    };

    pc.current.onicecandidate = (event) => {
      if (event.candidate && otherUserId.current) {
        socket.emit("ice-candidate", { target: otherUserId.current, candidate: event.candidate });
      }
    };

    socket.on("other-user", (userId) => {
      otherUserId.current = userId;
      pc.current.createOffer()
        .then(offer => pc.current.setLocalDescription(offer))
        .then(() => {
          socket.emit("offer", { target: userId, sdp: pc.current.localDescription, caller: socket.id });
        });
    });

    socket.on("user-joined", (userId) => {
      otherUserId.current = userId;
    });

    socket.on("offer", async (payload) => {
      await pc.current.setRemoteDescription(payload.sdp);
      const answer = await pc.current.createAnswer();
      await pc.current.setLocalDescription(answer);
      socket.emit("answer", { target: payload.caller, sdp: answer });
    });

    socket.on("answer", async (payload) => {
      await pc.current.setRemoteDescription(payload.sdp);
    });

    socket.on("ice-candidate", async (payload) => {
      try { await pc.current.addIceCandidate(payload.candidate); } 
      catch (e) { console.error(e); }
    });

  }, []);

  const joinRoom = () => {
    if (roomId !== "") socket.emit("join-room", roomId);
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>2-User Video Call</h2>
      <input 
        type="text" 
        placeholder="Enter Room Code" 
        value={roomId} 
        onChange={e => setRoomId(e.target.value)} 
      />
      <button onClick={joinRoom}>Join Room</button>
      <div style={{ display: "flex", marginTop: "20px" }}>
        <video ref={localVideoRef} autoPlay playsInline muted style={{ width: "300px" }} />
        <video ref={remoteVideoRef} autoPlay playsInline style={{ width: "300px", marginLeft: "10px" }} />
      </div>
    </div>
  );
}

export default App;