import React, { useEffect, useRef, useState, useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";
import socket from "../socket";
import gsap from "gsap";

function Room() {
    const canvasRef = useRef(null);
    const chatEndRef = useRef(null);
    const location = useLocation();
    const username = location.state?.name;
    const [message, setMessage] = useState("");
    const [chat, setChat] = useState([]);
    const [isDrawer, setIsDrawer] = useState(false);
    const [drawerName, setDrawerName] = useState("");
    const [word, setWord] = useState("");
    const [timer, setTimer] = useState(60);
    const [players, setPlayers] = useState([]);
    const [gameOver, setGameOver] = useState(false);
    const [color, setColor] = useState("#000000");
    const [brushSize, setBrushSize] = useState(5);
    const [emojis, setEmojis] = useState([]);

    // Helper for 00:60 format
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Circle Progress Calculation
    const strokeDashoffset = 125 - (125 * timer) / 60;

    useLayoutEffect(() => {
        const tl = gsap.timeline();
        tl.from(".header-studio", { y: -20, opacity: 0, duration: 0.5 })
            .from(".canvas-container", { scale: 0.95, opacity: 0, duration: 0.5 }, "-=0.2");
    }, []);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chat]);

    const sendMessage = () => {
        if (!message.trim() || isDrawer) return;
        socket.emit("send_message", { username, message });
        setMessage("");
    };

    useEffect(() => {
        socket.connect();
        socket.emit("join_room", { username });
        socket.on("room_update", (playersList) => { setPlayers(playersList); });
        socket.on("room_full", () => { alert("Room is full"); });
        socket.on("receive_message", (data) => { setChat((prev) => [...prev, data]); });
        socket.on("correct_guess", (data) => {
            setChat((prev) => [...prev, { ...data, correct: true }]);
            const ctx = canvasRef.current.getContext("2d");
            ctx.clearRect(0, 0, 800, 500);
        });
        socket.on("drawer_selected", ({ drawerId, drawerName }) => {
            setDrawerName(drawerName);
            setIsDrawer(socket.id === drawerId);
        });
        socket.on("your_word", (word) => { setWord(word); });
        socket.on("game_state", ({ players, drawer, word, timer }) => {
            setPlayers(players); setTimer(timer);
            if (drawer) { setDrawerName(drawer.name); setIsDrawer(socket.id === drawer.id); }
            if (socket.id === drawer?.id) { setWord(word); }
        });
        socket.on("drawing_history", (history) => {
            const ctx = canvasRef.current.getContext("2d");
            ctx.clearRect(0, 0, 800, 500);
            history.forEach(({ x, y, color, brushSize }) => {
                ctx.strokeStyle = color; ctx.lineWidth = brushSize;
                ctx.lineTo(x, y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x, y);
            });
        });
        return () => { socket.off(); };
    }, [username]);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        let drawing = false;

        const getCoords = (e) => {
            const rect = canvas.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            const x = (clientX - rect.left) * (canvas.width / rect.width);
            const y = (clientY - rect.top) * (canvas.height / rect.height);
            return { x, y };
        };

        const startDraw = (e) => {
            if (!isDrawer) return;
            drawing = true;
            const { x, y } = getCoords(e);
            ctx.beginPath();
            ctx.moveTo(x, y);
        };

        const draw = (e) => {
            if (!drawing || !isDrawer) return;
            const { x, y } = getCoords(e);
            ctx.lineWidth = brushSize;
            ctx.strokeStyle = color;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.lineTo(x, y);
            ctx.stroke();
            socket.emit("draw", { x, y, color, brushSize });
        };

        const endDraw = () => { drawing = false; ctx.beginPath(); };

        canvas.addEventListener("mousedown", startDraw);
        canvas.addEventListener("mousemove", draw);
        canvas.addEventListener("mouseup", endDraw);
        canvas.addEventListener("touchstart", (e) => { e.preventDefault(); startDraw(e); }, { passive: false });
        canvas.addEventListener("touchmove", (e) => { e.preventDefault(); draw(e); }, { passive: false });
        canvas.addEventListener("touchend", endDraw);

        socket.on("draw", ({ x, y, color, brushSize }) => {
            ctx.strokeStyle = color; ctx.lineWidth = brushSize;
            ctx.lineCap = "round"; ctx.lineJoin = "round";
            ctx.lineTo(x, y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x, y);
        });

        return () => { socket.off("draw"); };
    }, [isDrawer, color, brushSize]);

    useEffect(() => {
        socket.on("timer_update", (time) => setTimer(time));
        socket.on("clear_canvas", () => {
            canvasRef.current.getContext("2d").clearRect(0, 0, 800, 500);
        });
        socket.on("game_over", (players) => {
            setPlayers(players);
            setGameOver(true);
            localStorage.removeItem("joined");
            localStorage.removeItem("username");
        });
        socket.on("receive_emoji", ({ emoji }) => {
            setEmojis((prev) => [...prev, { emoji, id: Date.now() }]);
            setTimeout(() => setEmojis((prev) => prev.slice(1)), 2000);
        });
        socket.on("restart_game", () => {
            setGameOver(false); setChat([]); setWord(""); setTimer(60);
            canvasRef.current.getContext("2d").clearRect(0, 0, 800, 500);
        });
    }, []);

    useEffect(() => {
        const username = localStorage.getItem("username");

        if (!username) {
            window.location.href = "/";
        }
    }, []);

    return (
        <div className="main-wrapper h-screen w-full bg-[#0a0a0c] text-slate-100 flex flex-col overflow-hidden">

            {/* 1. STUDIO HEADER */}
            <header className="header-studio flex-none min-h-17.5 md:h-24 bg-[#0a0a0c]/90 backdrop-blur-xl border-b border-white/10 flex flex-wrap items-center justify-between px-4 md:px-10 z-50 transition-all">

                {/* 1. BRANDING & USER */}
                <div className="flex items-center gap-3 md:gap-6">
                    <div className="relative group flex items-center gap-3">
                        {/* High-end Logo styling */}
                        <div className="relative">
                            <div className="absolute -inset-1 bg-linear-to-r from-indigo-500 to-purple-600 rounded-full blur opacity-40 group-hover:opacity-75 transition duration-500"></div>
                            <img
                                className="relative w-8 h-8 md:w-11 md:h-11 rounded-full border border-white/20 object-cover"
                                src="https://img.freepik.com/free-vector/pen-scribble-ball_78370-4312.jpg?semt=ais_hybrid&w=740&q=80"
                                alt="Logo"
                            />
                        </div>

                        <div className="flex flex-col ">
                            <h1 className="text-4xl font-black italic tracking-tighter text-white drop-shadow-[0_5px_0_#3b82f6]">
                                SCRIBBI<span className="text-blue-500">.</span>
                            </h1>
                            <div className="flex items-center gap-1.5 mt-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]"></div>
                                <span className="text-[10px] md:text-xs font-bold text-slate-400 truncate max-w-20 md:max-w-none uppercase tracking-tight">
                                    {username}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. CIRCULAR TIMER  */}
                <div className="timer-hud order-3 md:order-2 w-full md:w-auto mt-2 md:mt-0 flex items-center justify-center md:justify-end gap-4 bg-white/5 md:bg-transparent py-2 md:py-0 rounded-xl border border-white/5 md:border-none">
                    <div className="flex flex-col items-end">
                        <span className="text-[8px] md:text-[10px] text-slate-500 font-black uppercase tracking-normal">Time Left</span>
                        <span className={`text-lg md:text-2xl font-mono font-black ${timer < 10 ? 'text-rose-500 animate-pulse' : 'text-white'}`}>
                            {formatTime(timer)}
                        </span>
                    </div>

                    <div className="relative flex items-center justify-center w-12 h-12 md:w-16 md:h-16">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 50 50">
                            {/* Background Track */}
                            <circle
                                cx="25"
                                cy="25"
                                r="20"
                                stroke="currentColor"
                                strokeWidth="3"
                                fill="transparent"
                                className="text-white/5"
                            />
                            {/* Progress Circle */}
                            <circle
                                cx="25"
                                cy="25"
                                r="20"
                                stroke="currentColor"
                                strokeWidth="3"
                                fill="transparent"
                                strokeDasharray="125.6" // Circumference (2 * pi * 20)
                                strokeDashoffset={125.6 - (timer / 60) * 125.6} // depletes from 60 to 0
                                strokeLinecap="round"
                                className={`${timer < 10 ? 'text-rose-500 shadow-[0_0_10px_#f43f5e]' : 'text-indigo-500'} transition-all duration-1000 ease-linear`}
                            />
                        </svg>

                        {/* Glowing indicator  */}
                        <div className={`absolute w-1.5 h-1.5 rounded-full shadow-[0_0_12px_#fff] ${timer < 10 ? 'bg-rose-500' : 'bg-white'}`}></div>
                    </div>
                </div>

                {/* 3. PLAYER COUNT */}
                <div className="order-2 md:order-3 flex items-center gap-2 bg-[#1a1a20] px-3 py-2 md:px-4 md:py-2 rounded-2xl border border-white/10 shadow-lg">
                    <div className="hidden sm:flex -space-x-2">
                        {players.slice(0, 3).map(p => (
                            <div key={p.id} className="w-6 h-6 rounded-full border-2 border-[#1a1a20] bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-[8px] font-black uppercase text-white shadow-md">
                                {p.name[0]}
                            </div>
                        ))}
                    </div>
                    <div className="flex flex-col md:flex-row md:items-center md:gap-2">
                        <span className="text-xs font-black text-white">{players.length}</span>
                        <span className="text-[8px] md:text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Players</span>
                    </div>
                </div>

            </header>

            {/* 2. DASHBOARD HUD */}
            <div className="flex-none bg-[#1a1a20] h-8 flex items-center justify-center border-b border-white/5 shadow-inner">
                {isDrawer ? (
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Draw this:</span>
                        <span className="text-[11px] font-black text-white px-2 py-0.5 bg-indigo-600 rounded uppercase">{word}</span>
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Artist:</span>
                        <span className="text-[11px] font-black text-indigo-400 uppercase">{drawerName}</span>
                    </div>
                )}
            </div>

            {/* 3. CANVAS ARENA */}
            <main className="grow relative bg-[#0f0f13] p-4 flex flex-col items-center justify-center overflow-hidden">
                <div className="canvas-container w-full h-full max-w-5xl bg-white rounded-2xl shadow-[0_0_60px_rgba(0,0,0,0.6)] relative overflow-hidden ring-4 ring-[#1a1a20]">
                    <canvas
                        ref={canvasRef}
                        width={800}
                        height={500}
                        className="w-full h-full touch-none cursor-crosshair"
                    />

                    {/* FIXED DESIGNER DOCK */}
                    {isDrawer && (
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-6 bg-[#121217]/90 backdrop-blur-xl px-6 py-4 rounded-3xl border border-white/20 shadow-2xl z-40">
                            <div className="flex flex-col items-center gap-1">
                                <span className="text-[8px] font-black uppercase text-slate-500">Color</span>
                                <input
                                    type="color"
                                    value={color}
                                    onChange={(e) => setColor(e.target.value)}
                                    className="w-10 h-10 rounded-xl border-none bg-transparent cursor-pointer hover:scale-110 transition-transform"
                                />
                            </div>

                            <div className="h-10 w-px bg-white/10" />

                            <div className="flex flex-col items-center gap-2">
                                <span className="text-[8px] font-black uppercase text-slate-500">Size: {brushSize}px</span>
                                <input
                                    type="range"
                                    min="1"
                                    max="20"
                                    value={brushSize}
                                    onChange={(e) => setBrushSize(parseInt(e.target.value))}
                                    className="w-32 accent-indigo-500"
                                />
                            </div>

                            <div className="h-10 w-px bg-white/10" />

                            <button
                                onClick={() => {
                                    canvasRef.current.getContext("2d").clearRect(0, 0, 800, 500);
                                    socket.emit("clear_canvas");
                                }}
                                className="bg-rose-500/20 text-rose-500 border border-rose-500/30 px-5 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-rose-500 hover:text-white transition-all shadow-lg"
                            >
                                Clear All
                            </button>
                        </div>
                    )}
                </div>
            </main>

            {/* 4. INTERACTION HUB */}
            <footer className="flex-none h-[28vh] bg-[#121217] border-t border-white/10 flex flex-col">
                <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
                    {chat.map((msg, i) => (
                        <div key={i} className={`flex items-start gap-3 ${msg.correct ? 'justify-center py-2' : ''}`}>
                            {msg.correct ? (
                                <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-6 py-2 rounded-full text-xs font-black shadow-[0_0_20px_rgba(16,185,129,0.1)]">
                                    🎯 {msg.username.toUpperCase()} DISCOVERED THE WORD!
                                </div>
                            ) : (
                                <div className="flex gap-2 text-sm">
                                    <span className="font-black text-indigo-400 uppercase text-[10px] mt-1">{msg.username}:</span>
                                    <span className="text-slate-200 font-medium">{msg.message}</span>
                                </div>
                            )}
                        </div>
                    ))}
                    <div ref={chatEndRef} />
                </div>

                <div className="p-4 bg-[#0a0a0c]/80 flex flex-col gap-3">
                    <div className="flex justify-evenly">
                        {["😂", "🔥", "👏", "😮", "🎉"].map(e => (
                            <button key={e} onClick={() => socket.emit("send_emoji", e)} className="text-xl hover:scale-125 active:scale-90 transition-transform">
                                {e}
                            </button>
                        ))}
                    </div>
                    <div className="flex gap-3">
                        <input
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            disabled={isDrawer}
                            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                            placeholder={isDrawer ? "CANNOT CHAT WHILE DRAWING" : "TYPE YOUR GUESS..."}
                            className="flex-1 bg-[#1a1a20] border border-white/5 rounded-xl px-5 py-3.5 text-xs font-bold tracking-wider focus:border-indigo-500 outline-none disabled:opacity-30 transition-all text-white placeholder:text-slate-600 uppercase"
                        />
                        <button
                            onClick={sendMessage}
                            disabled={isDrawer}
                            className="bg-indigo-600 hover:bg-indigo-500 px-8 rounded-xl font-black text-[10px] uppercase shadow-lg shadow-indigo-600/20 disabled:bg-slate-800 transition-colors"
                        >
                            Guess
                        </button>
                    </div>
                </div>
            </footer>

            {/* SCOREBOARD OVERLAY */}
            {gameOver && (
                <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-100 flex items-center justify-center p-6">
                    <div className="bg-[#121217] p-10 rounded-[3rem] border border-white/10 max-w-sm w-full shadow-[0_0_100px_rgba(99,102,241,0.2)]">
                        <span className="text-indigo-500 font-black tracking-tight text-[20px] block mb-2 text-center uppercase">Round Over</span>
                        <h2 className="text-white font-black text-3xl mb-8 text-center uppercase italic">The Winner's Circle</h2>
                        <div className="space-y-4 mb-10">
                            {players.sort((a, b) => b.score - a.score).map((p, i) => (
                                <div key={p.id} className={`flex justify-between items-center p-4 rounded-2xl ${i === 0 ? 'bg-indigo-600 ring-4 ring-indigo-400/20' : 'bg-white/5 opacity-70'}`}>
                                    <div className="flex items-center gap-3">
                                        <span className="font-black text-xs text-white/50">{i + 1}</span>
                                        <span className="font-black text-sm uppercase">{p.name}</span>
                                    </div>
                                    <span className="font-mono font-black text-lg">{p.score}</span>
                                </div>
                            ))}
                        </div>
                        <button onClick={() => socket.emit("play_again")} className="w-full bg-white text-black py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-indigo-500 hover:text-white transition-all transform active:scale-95 shadow-xl">Start Rematch</button>
                    </div>
                </div>
            )}

            <style>{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                input[type="range"] {
                    -webkit-appearance: none;
                    height: 4px;
                    background: rgba(255,255,255,0.1);
                    border-radius: 5px;
                }
                input[type="range"]::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    width: 16px;
                    height: 16px;
                    background: #6366f1;
                    border-radius: 50%;
                    cursor: pointer;
                    border: 2px solid #fff;
                }
            `}</style>
        </div>
    );
}

export default Room;