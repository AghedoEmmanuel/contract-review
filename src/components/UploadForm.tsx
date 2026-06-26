"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const UploadForm = () => {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const handleFileChange = (selectedFile: File | null) => {
    if (selectedFile && selectedFile.type !== "application/pdf") {
      setError("Only PDF files are accepted");
      return;
    }

    if (selectedFile && selectedFile.size > 10 * 1024 * 1024) {
      setError("File must be under 10MB");
      return;
    }

    setFile(selectedFile);
    setError("");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileChange(droppedFile);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError("");
    setSuccess("");

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/contracts/uploads", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Something went wrong");
      setUploading(false);
    } else {
      setSuccess("Contract Uploaded! Text extraction is running in the background.");
      setFile(null);
      setUploading(false);
      router.refresh();
    }
  };

  return (
    <div className="bg-white rounded-lg border p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload a Contract</h2>

      {/* Drag and drop area */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragOver ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
        }`}
      >
        <input
          type="file"
          accept=".pdf"
          onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
          id="file-input"
          className="hidden"
        />
        <label htmlFor="file-input" className="cursor-pointer">
          <div className="text-gray-600">
            <p className="font-medium">Drop your PDF here or click to browse</p>
            <p className="text-sm text-gray-500">Maximum file size: 10MB</p>
          </div>
        </label>
      </div>

      {/* Selected file display */}
      {file && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
          <p className="text-sm text-blue-900">
            <strong>Selected:</strong> {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
          </p>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
          <p className="text-sm text-red-900">{error}</p>
        </div>
      )}

      {/* Success message */}
      {success && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded">
          <p className="text-sm text-green-900">{success}</p>
        </div>
      )}

      {/* Upload button */}
      <div className="mt-6">
        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {uploading ? "Uploading..." : "Upload Contract"}
        </button>
      </div>
    </div>
  );
};

export default UploadForm;
