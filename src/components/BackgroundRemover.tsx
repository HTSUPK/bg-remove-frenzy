import React, { useState, useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { pipeline, env } from '@huggingface/transformers';

// Configure transformers.js to use modern web capabilities
env.allowLocalModels = false;
env.useBrowserCache = false;

const MAX_IMAGE_DIMENSION = 1024;

interface BackgroundRemoverProps {
  originalImage: string | null;
  onProcessed: (processedImageUrl: string) => void;
  onLoading: (isLoading: boolean) => void;
}

const BackgroundRemover: React.FC<BackgroundRemoverProps> = ({
  originalImage,
  onProcessed,
  onLoading
}) => {
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    // Load the model when component mounts
    let isMounted = true;
    
    const loadModel = async () => {
      try {
        toast({
          title: "Loading AI model...",
          description: "This might take a moment the first time"
        });
        
        await pipeline('image-segmentation', 'Xenova/segformer-b0-finetuned-ade-512-512', {
          progress_callback: (progress: any) => {
            if (isMounted) {
              setProgress(Math.round(progress.progress * 100));
            }
          },
        });
        
        if (isMounted) {
          setIsModelLoaded(true);
          toast({
            title: "Model loaded successfully",
            description: "Ready to remove backgrounds"
          });
        }
      } catch (error) {
        console.error("Error loading model:", error);
        toast({
          variant: "destructive",
          title: "Failed to load AI model",
          description: "Please check your connection and try again"
        });
      }
    };

    loadModel();

    return () => {
      isMounted = false;
    };
  }, [toast]);

  useEffect(() => {
    // Process image when original image and model are both ready
    if (originalImage && isModelLoaded) {
      processImage(originalImage);
    }
  }, [originalImage, isModelLoaded]);

  const resizeImageIfNeeded = (
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    image: HTMLImageElement
  ) => {
    let width = image.naturalWidth;
    let height = image.naturalHeight;

    if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
      if (width > height) {
        height = Math.round((height * MAX_IMAGE_DIMENSION) / width);
        width = MAX_IMAGE_DIMENSION;
      } else {
        width = Math.round((width * MAX_IMAGE_DIMENSION) / height);
        height = MAX_IMAGE_DIMENSION;
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(image, 0, 0, width, height);
      return true;
    }

    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(image, 0, 0);
    return false;
  };

  const processImage = async (imageUrl: string) => {
    try {
      onLoading(true);
      toast({
        title: "Processing your image",
        description: "Using AI to remove the background"
      });

      // Create image element from URL
      const imageElement = await loadImageFromUrl(imageUrl);
      
      // Process the image
      const result = await removeBackground(imageElement);
      
      // Convert blob to data URL
      const processedImageUrl = URL.createObjectURL(result);
      
      // Return the processed image URL
      onProcessed(processedImageUrl);
      onLoading(false);
      
      toast({
        title: "Background removed",
        description: "Your image has been processed successfully"
      });
    } catch (error) {
      console.error("Error processing image:", error);
      onLoading(false);
      toast({
        variant: "destructive",
        title: "Processing failed",
        description: "There was an error removing the background"
      });
    }
  };

  const loadImageFromUrl = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  };

  const removeBackground = async (imageElement: HTMLImageElement): Promise<Blob> => {
    try {
      console.log('Starting background removal process...');
      const segmenter = await pipeline('image-segmentation', 'Xenova/segformer-b0-finetuned-ade-512-512', {
        device: 'auto', // Use WebGPU if available, fallback to WebGL/CPU
      });
      
      // Convert HTMLImageElement to canvas
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) throw new Error('Could not get canvas context');
      
      // Resize image if needed and draw it to canvas
      const wasResized = resizeImageIfNeeded(canvas, ctx, imageElement);
      console.log(`Image ${wasResized ? 'was' : 'was not'} resized. Final dimensions: ${canvas.width}x${canvas.height}`);
      
      // Get image data as base64
      const imageData = canvas.toDataURL('image/jpeg', 0.8);
      console.log('Image converted to base64');
      
      // Process the image with the segmentation model
      console.log('Processing with segmentation model...');
      const result = await segmenter(imageData);
      
      console.log('Segmentation result:', result);
      
      if (!result || !Array.isArray(result) || result.length === 0 || !result[0].mask) {
        throw new Error('Invalid segmentation result');
      }
      
      // Create a new canvas for the masked image
      const outputCanvas = document.createElement('canvas');
      outputCanvas.width = canvas.width;
      outputCanvas.height = canvas.height;
      const outputCtx = outputCanvas.getContext('2d');
      
      if (!outputCtx) throw new Error('Could not get output canvas context');
      
      // Draw original image
      outputCtx.drawImage(canvas, 0, 0);
      
      // Apply the mask
      const outputImageData = outputCtx.getImageData(
        0, 0,
        outputCanvas.width,
        outputCanvas.height
      );
      const data = outputImageData.data;
      
      // Apply inverted mask to alpha channel - looking for person segmentation
      const personMask = result.find(r => r.label === 'person')?.mask || result[0].mask;
      
      for (let i = 0; i < personMask.data.length; i++) {
        // Apply mask - keep the person, remove background
        // Using the mask value directly since we want to keep the person (1) and remove background (0)
        const alpha = Math.round(personMask.data[i] * 255);
        data[i * 4 + 3] = alpha;
      }
      
      outputCtx.putImageData(outputImageData, 0, 0);
      console.log('Mask applied successfully');
      
      // Convert canvas to blob
      return new Promise((resolve, reject) => {
        outputCanvas.toBlob(
          (blob) => {
            if (blob) {
              console.log('Successfully created final blob');
              resolve(blob);
            } else {
              reject(new Error('Failed to create blob'));
            }
          },
          'image/png',
          1.0
        );
      });
    } catch (error) {
      console.error('Error removing background:', error);
      throw error;
    }
  };

  return (
    <div className="hidden">
      {!isModelLoaded && (
        <div className="text-center">
          <p>Loading AI model: {progress}%</p>
        </div>
      )}
    </div>
  );
};

export default BackgroundRemover;
