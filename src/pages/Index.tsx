
import React, { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import BackgroundRemover from '@/components/BackgroundRemover';
import { Loader2 } from "lucide-react";

const Index = () => {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Check file type
    if (!file.type.match('image.*')) {
      toast({
        variant: "destructive",
        title: "Invalid file type",
        description: "Please select an image file"
      });
      return;
    }
    
    // Check file size (limit to 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "File too large",
        description: "Please select an image smaller than 10MB"
      });
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      setOriginalImage(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };
  
  const handleProcessed = (processedImageUrl: string) => {
    setProcessedImage(processedImageUrl);
    setIsLoading(false);
  };
  
  const handleDownload = () => {
    if (processedImage) {
      const link = document.createElement('a');
      link.href = processedImage;
      link.download = 'image-no-background.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };
  
  const handleReset = () => {
    setOriginalImage(null);
    setProcessedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-gray-50 to-gray-100">
      <div className="w-full max-w-4xl mx-auto">
        <div className="text-center mb-10 space-y-2">
          <h1 className="text-4xl font-medium tracking-tight">Background Remover</h1>
          <p className="text-gray-500 max-w-xl mx-auto">
            Upload an image and our AI will automatically remove the background, giving you a clean transparent PNG.
          </p>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden p-8">
          {!originalImage ? (
            <div className="flex flex-col items-center justify-center min-h-[300px] border-2 border-dashed border-gray-200 rounded-lg p-8">
              <input
                type="file"
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
                ref={fileInputRef}
              />
              <Button 
                className="bg-blue-500 hover:bg-blue-600 transition-colors px-6 py-5 h-auto text-lg"
                onClick={() => fileInputRef.current?.click()}
              >
                Upload Image
              </Button>
              <p className="text-gray-400 mt-3 text-sm">
                Supports JPG, PNG, WEBP (Max 10MB)
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="flex flex-col">
                  <h2 className="text-lg font-medium mb-3">Original Image</h2>
                  <div className="bg-gray-50 rounded-lg overflow-hidden flex items-center justify-center p-4 h-[300px]">
                    <img 
                      src={originalImage} 
                      alt="Original" 
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                </div>
                
                <div className="flex flex-col">
                  <h2 className="text-lg font-medium mb-3">Processed Image</h2>
                  <div className="bg-[url('/placeholder.svg')] bg-center bg-repeat rounded-lg overflow-hidden flex items-center justify-center p-4 h-[300px]">
                    {isLoading ? (
                      <div className="flex flex-col items-center justify-center">
                        <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
                        <p className="text-gray-500 mt-3">Processing your image...</p>
                      </div>
                    ) : processedImage ? (
                      <img 
                        src={processedImage} 
                        alt="Processed" 
                        className="max-w-full max-h-full object-contain"
                      />
                    ) : (
                      <p className="text-gray-400">Your processed image will appear here</p>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-4 justify-center">
                <Button 
                  variant="outline"
                  onClick={handleReset}
                >
                  Upload Another Image
                </Button>
                
                {processedImage && (
                  <Button 
                    className="bg-blue-500 hover:bg-blue-600 transition-colors"
                    onClick={handleDownload}
                  >
                    Download Image
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
        
        <div className="mt-8 text-center text-gray-500 text-sm">
          <p>Your privacy is important to us. All processing happens directly in your browser.</p>
          <p>No images are sent to any server.</p>
        </div>
      </div>
      
      {originalImage && (
        <BackgroundRemover
          originalImage={originalImage}
          onProcessed={handleProcessed}
          onLoading={setIsLoading}
        />
      )}
    </div>
  );
};

export default Index;
