import React, { useState, useLayoutEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import gsap from "gsap";

function Join() {
  const [name, setName] = useState("");
  const navigate = useNavigate();
  const boxRef = useRef(null);

  useLayoutEffect(() => {
    // Floating animation
    gsap.to(boxRef.current, {
      y: "-=20",
      duration: 2,
      repeat: -1,
      yoyo: true,
      ease: "power1.inOut"
    });
  }, []);

  const joinRoom = () => {
    if (!name) return;
    navigate("/room", { state: { name } });
  };

  return (
    <div className="h-screen flex items-center justify-center bg-[#050505] overflow-hidden relative">
      {/* Decorative Background Elements */}
      <div className="absolute w-125 h-125 bg-purple-600/20 rounded-full blur-[120px] -top-20 -left-20" />
      <div className="absolute w-100 h-100 bg-blue-600/20 rounded-full blur-[100px] -bottom-20 -right-20" />

      <div ref={boxRef} className="relative z-10 w-full max-w-md px-6">
        <div className="bg-[#1a1a1e] border-4 border-[#2d2d32] rounded-[40px] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
          <div className="text-center mb-10">
            <h1 className="text-6xl font-black italic tracking-tighter text-white drop-shadow-[0_5px_0_#3b82f6]">
              SCRIBBI<span className="text-blue-500">.</span>
            </h1>
            <p className="text-gray-400 font-bold uppercase tracking-widest text-xs mt-2">The Ultimate Drawing Arena</p>
          </div>

          <div className="space-y-4">
            <div className="group">
              <label className="text-xs font-black text-gray-500 ml-4 mb-1 block uppercase">Player Tag</label>
              <input
                className="w-full bg-[#121214] border-2 border-[#2d2d32] group-hover:border-blue-500 p-4 rounded-2xl outline-none text-white font-bold transition-all placeholder:text-gray-700"
                placeholder="TYPE YOUR NAME..."
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <button
              onClick={joinRoom}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-5 rounded-2xl shadow-[0_8px_0_#1d4ed8] active:shadow-none active:translate-y-2 transition-all text-xl uppercase italic tracking-tighter"
            >
              Enter Arena
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Join;