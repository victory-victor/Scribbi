import { io } from "socket.io-client";

const socket = io("https://scribbi.onrender.com/", {
  autoConnect: false,
  transports: ["websocket"],
});

export default socket;