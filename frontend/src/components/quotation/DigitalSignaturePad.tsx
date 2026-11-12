'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { PenTool, Upload, Type, Trash2, Check, RefreshCw, Sparkles, Image as ImageIcon } from 'lucide-react';

interface DigitalSignaturePadProps {
  value?: string;
  onChange: (signatureDataUrl: string) => void;
  signerName?: string;
  className?: string;
}

export const DigitalSignaturePad: React.FC<DigitalSignaturePadProps> = ({
  value = '',
  onChange,
  signerName = '',
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [activeTab, setActiveTab] = useState<'draw' | 'type' | 'upload'>('draw');
  const [strokeCount, setStrokeCount] = useState(0);
  const [penColor, setPenColor] = useState('#0e4b31'); // Alpha Elevators signature green

  // Helper to get coordinates from mouse or touch event
  const getCoordinates = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
    canvas: HTMLCanvasElement
  ): { x: number; y: number } | null => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e) {
      if (e.touches.length === 0) return null;
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    } else {
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    }
  };

  // Start Drawing
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const coords = getCoordinates(e, canvas);
    if (!coords) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    ctx.strokeStyle = penColor;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  // Continue Drawing
  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const coords = getCoordinates(e, canvas);
    if (!coords) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
    setStrokeCount((prev) => prev + 1);
  };

  // End Drawing & Export DataURL
  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    onChange(dataUrl);
  };

  // Clear canvas
  const handleClear = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    setStrokeCount(0);
    onChange('');
  };

  // Auto-generate signature from Name using cursive styling on canvas
  const handleGenerateFromName = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const nameToRender = signerName.trim() || 'Client Signatory';

    // Clear previous drawing
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Render smooth cursive text
    ctx.save();
    ctx.fillStyle = penColor;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';

    // Try cursive fonts
    ctx.font = 'italic bold 34px "Segoe Script", "Brush Script MT", "Caveat", "Dancing Script", cursive';
    const centerY = canvas.height / 2 - 2;
    ctx.fillText(nameToRender, canvas.width / 2, centerY);

    // Decorative flourish underline below the signature
    ctx.strokeStyle = penColor;
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    const textWidth = ctx.measureText(nameToRender).width;
    const startX = Math.max(30, canvas.width / 2 - textWidth / 2 - 15);
    const endX = Math.min(canvas.width - 30, canvas.width / 2 + textWidth / 2 + 25);
    const lineY = centerY + 24;

    ctx.moveTo(startX, lineY);
    ctx.quadraticCurveTo(canvas.width / 2, lineY - 6, endX, lineY);
    ctx.stroke();
    ctx.restore();

    setStrokeCount(10);
    const dataUrl = canvas.toDataURL('image/png');
    onChange(dataUrl);
  }, [signerName, penColor, onChange]);

  // Handle Image Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        // Load into image and draw onto canvas with proportional aspect ratio
        const img = new Image();
        img.onload = () => {
          const canvas = canvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              const hRatio = canvas.width / img.width;
              const vRatio = canvas.height / img.height;
              const ratio = Math.min(hRatio, vRatio, 1) * 0.85;
              const centerShiftX = (canvas.width - img.width * ratio) / 2;
              const centerShiftY = (canvas.height - img.height * ratio) / 2;
              ctx.drawImage(
                img,
                0,
                0,
                img.width,
                img.height,
                centerShiftX,
                centerShiftY,
                img.width * ratio,
                img.height * ratio
              );
              onChange(canvas.toDataURL('image/png'));
              setStrokeCount(10);
              return;
            }
          }
          onChange(result);
        };
        img.src = result;
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // If value is provided externally, draw it on canvas on mount
  useEffect(() => {
    if (!value) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = value;
  }, []);

  return (
    <div className={`space-y-2.5 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <PenTool className="w-3.5 h-3.5 text-teal-600" />
            <span>Digital Client Signature:</span>
          </label>
          <p className="text-[10px] text-slate-500">
            Signs this quotation digitally. Automatically reflects on <span className="font-semibold text-teal-700">every page</span> of the live PDF.
          </p>
        </div>

        {value && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
            <Check className="w-3 h-3 text-emerald-600" />
            Active on all PDF pages
          </span>
        )}
      </div>

      {/* Tabs: Draw, Type, Upload */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-1.5 gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('draw')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
              activeTab === 'draw'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <PenTool className="w-3 h-3" />
            <span>Draw</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('type');
              handleGenerateFromName();
            }}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
              activeTab === 'type'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Type className="w-3 h-3" />
            <span>Adopt from Name</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('upload');
              fileInputRef.current?.click();
            }}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
              activeTab === 'upload'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Upload className="w-3 h-3" />
            <span>Upload Image</span>
          </button>
        </div>

        {/* Color Selector */}
        <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
          <span>Ink:</span>
          <button
            type="button"
            onClick={() => setPenColor('#0e4b31')}
            title="Alpha Green"
            className={`w-4 h-4 rounded-full border transition-all ${
              penColor === '#0e4b31' ? 'ring-2 ring-teal-500 scale-110' : 'opacity-70'
            }`}
            style={{ backgroundColor: '#0e4b31' }}
          />
          <button
            type="button"
            onClick={() => setPenColor('#001f5d')}
            title="Navy Blue"
            className={`w-4 h-4 rounded-full border transition-all ${
              penColor === '#001f5d' ? 'ring-2 ring-teal-500 scale-110' : 'opacity-70'
            }`}
            style={{ backgroundColor: '#001f5d' }}
          />
          <button
            type="button"
            onClick={() => setPenColor('#000000')}
            title="Black"
            className={`w-4 h-4 rounded-full border transition-all ${
              penColor === '#000000' ? 'ring-2 ring-teal-500 scale-110' : 'opacity-70'
            }`}
            style={{ backgroundColor: '#000000' }}
          />
        </div>
      </div>

      {/* Hidden File Input for Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Canvas Area */}
      <div className="relative border-2 border-dashed border-teal-300 rounded-xl bg-white overflow-hidden shadow-inner group">
        <canvas
          ref={canvasRef}
          width={520}
          height={130}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="w-full h-28 block touch-none cursor-crosshair bg-white"
        />

        {/* Watermark / Guidance Text when canvas is blank */}
        {!value && strokeCount === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-slate-300 select-none">
            <PenTool className="w-6 h-6 mb-1 opacity-40 text-teal-500" />
            <span className="text-xs font-semibold text-slate-400">Sign here using mouse, finger or stylus</span>
            <span className="text-[10px] text-slate-400">or click &quot;Adopt from Name&quot; / &quot;Upload Image&quot;</span>
          </div>
        )}

        {/* Clear Button (overlayed) */}
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute top-2 right-2 px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-md text-[10px] font-bold flex items-center gap-1 transition-colors shadow-xs cursor-pointer"
            title="Clear signature"
          >
            <Trash2 className="w-3 h-3" />
            <span>Clear</span>
          </button>
        )}
      </div>

      {/* Controls & Status Bar */}
      <div className="flex items-center justify-between text-[11px] text-slate-600 pt-0.5">
        <div className="flex items-center gap-2">
          {activeTab === 'type' && (
            <button
              type="button"
              onClick={handleGenerateFromName}
              className="text-teal-700 hover:text-teal-800 font-bold flex items-center gap-1 text-[11px] underline cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Regenerate Signature</span>
            </button>
          )}
          {value && (
            <span className="text-[11px] text-teal-800 font-medium flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>Signature ready &amp; synchronized</span>
            </span>
          )}
        </div>

        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="text-rose-600 hover:text-rose-700 font-semibold text-[11px] flex items-center gap-1 cursor-pointer"
          >
            <Trash2 className="w-3 h-3" />
            <span>Reset Signature</span>
          </button>
        )}
      </div>
    </div>
  );
};

