
import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PDFDocument } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from 'sonner';
import * as pdfjsLib from 'pdfjs-dist';

// Import Cropper type
import Cropper from 'cropperjs';

// Set up PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@2/build/pdf.worker.js';

interface AppState {
  docs: any[];
  name: string;
  name_description: string;
  date_1: string;
  date_2: string;
  bottom_date_1: string;
  bottom_date_2: string;
  qr_code: string;
  attestation_number: string;
  showFillButton: { image: boolean; qr: boolean };
  selectedImageCroped: string;
}

const Index = () => {
  const [state, setState] = useState<AppState>({
    docs: [],
    name: "",
    name_description: "",
    date_1: "",
    date_2: "",
    bottom_date_1: "",
    bottom_date_2: "",
    qr_code: "",
    attestation_number: "",
    showFillButton: { image: false, qr: false },
    selectedImageCroped: ""
  });

  const [isLoading, setIsLoading] = useState(false);
  const [originalImageSrc, setOriginalImageSrc] = useState("");
  const [savedImageData, setSavedImageData] = useState("");
  const [selectedColor, setSelectedColor] = useState({ r: 255, g: 255, b: 255 });
  const [showModal, setShowModal] = useState(false);
  const [courseMode, setCourseMode] = useState("normal");
  const cropperRef = useRef<Cropper | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const isMobile = useIsMobile();

  // Load saved mode from localStorage
  useEffect(() => {
    const savedMode = localStorage.getItem('selectedMode');
    if (savedMode) {
      setCourseMode(savedMode);
    }
  }, []);

  // Save mode to localStorage when changed
  useEffect(() => {
    localStorage.setItem('selectedMode', courseMode);
  }, [courseMode]);

  // Handle PDF file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const docName = file.name;
      const arrayBuffer = await file.arrayBuffer();
      await loadPDF(arrayBuffer, docName);
    } catch (error) {
      console.error("Error loading PDF:", error);
      toast.error("Failed to load PDF file");
    }
  };

  // Handle image upload
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const imageSrc = e.target?.result as string;
        if (!imageSrc) return;
        
        setOriginalImageSrc(imageSrc);
        setSavedImageData("");

        // Automatically remove background on initial upload
        const imageWithNoBackground = await intelligentBackgroundRemoval(imageSrc, 40, selectedColor, 10);
        setState(prev => ({
          ...prev,
          selectedImageCroped: imageWithNoBackground,
          showFillButton: { ...prev.showFillButton, image: true }
        }));

        // Check if we should show the generate button
        if (state.showFillButton.qr) {
          const fillButton = document.getElementById("fillImageButton");
          if (fillButton) {
            fillButton.style.display = "block";
          }
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Error processing image:", error);
      toast.error("Failed to process image");
    }
  };

  // Load PDF and extract content
  const loadPDF = async (arrayBuffer: ArrayBuffer, docName: string) => {
    try {
      const typedArray = new Uint8Array(arrayBuffer);
      const pdfDocument = await pdfjsLib.getDocument({ data: typedArray }).promise;
      
      const pages: any[] = [];
      const docInfo = { name: docName, pages };
      
      setState(prev => ({
        ...prev,
        docs: [...prev.docs, docInfo]
      }));

      for (let i = 1; i <= pdfDocument.numPages; i++) {
        const pageInfo = { number: i, images: [] };
        pages.push(pageInfo);
        const page = await pdfDocument.getPage(i);
        await processPage(page, pageInfo);

        if (i === 2) {
          await processImagesFromPage(page, pageInfo);
        }
      }
    } catch (error) {
      console.error("Error in loadPDF:", error);
      toast.error("Error loading PDF");
    }
  };

  // Process PDF page content
  const processPage = async (page: any, pageInfo: any) => {
    try {
      const textContent = await page.getTextContent();
      const textItems = extractTextItems(textContent);
      
      if (pageInfo.number === 1) {
        processPageOneContent(textItems);
      } else if (pageInfo.number === 2) {
        processPageTwoContent(textItems);
      }
    } catch (error) {
      console.error("Error processing page:", error);
    }
  };

  // Extract text items from PDF content
  const extractTextItems = (textContent: any) => {
    return textContent.items
      .filter((item: any) => item.hasEOL !== true && item.height !== 0)
      .map((item: any) => ({
        text: item.str,
        fontSize: item.transform[0],
        x: item.transform[4],
        y: item.transform[5],
      }));
  };

  // Process content from page 1 of PDF
  const processPageOneContent = (textItems: any[]) => {
    let foundName = false;
    let foundDateLabel = false;
    let foundSedeLabel = false;

    textItems.forEach((item, index) => {
      if (foundName) {
        setState(prev => ({ ...prev, name_description: item.text }));
        foundName = false;
      } else if (index === 2) {
        setState(prev => ({ ...prev, name: item.text }));
        foundName = true;
      }

      if (!foundDateLabel && item.text.includes("DATA E ORARIO SVOLGIMENTO LEZIONE")) {
        foundDateLabel = true;
      } else if (foundDateLabel) {
        setState(prev => ({ ...prev, date_1: item.text }));
        foundDateLabel = false;
      }

      if (!foundSedeLabel && item.text.includes("SEDE DI SVOLGIMENTO DEL CORSO/I")) {
        foundSedeLabel = true;
      } else if (foundSedeLabel) {
        setState(prev => ({ ...prev, date_2: item.text }));
        foundSedeLabel = false;
      }
    });
  };

  // Process content from page 2 of PDF
  const processPageTwoContent = (textItems: any[]) => {
    const bottomDates: any[] = [];

    textItems.forEach((item) => {
      const xCoord = item.x;
      const yCoord = item.y;
      const proximityThreshold = 30;
      const targetX = 645.51656;
      const targetY = 537.021543;

      if (Math.abs(xCoord - targetX) < proximityThreshold && 
          Math.abs(yCoord - targetY) < proximityThreshold && 
          item.text.length === 10) {
        setState(prev => ({ ...prev, attestation_number: item.text }));
      }

      if (yCoord < 50 && 
          !item.text.includes("Powered by") && 
          !item.text.includes("e s.m.i.")) {
        bottomDates.push({ text: item.text, x: xCoord });
      }
    });

    if (bottomDates.length >= 2) {
      setState(prev => ({ 
        ...prev, 
        bottom_date_1: bottomDates[0].text,
        bottom_date_2: bottomDates[1].text
      }));
    }
  };

  // Extract images from PDF page
  const processImagesFromPage = async (page: any, pageInfo: any) => {
    try {
      const viewport = page.getViewport({ scale: 1.5 });
      const operatorList = await page.getOperatorList();
      const svgGfx = new pdfjsLib.SVGGraphics(page.commonObjs, page.objs);
      const svg = await svgGfx.getSVG(operatorList, viewport);
      
      const images = svg.querySelectorAll("image");
      images.forEach((image: Element) => {
        const imgSrc = image.getAttribute("href") || image.getAttribute("xlink:href");
        if (imgSrc) {
          pageInfo.images.push(imgSrc);
          if (pageInfo.number === 2) {
            setState(prev => ({ 
              ...prev, 
              qr_code: imgSrc,
              showFillButton: { ...prev.showFillButton, qr: true }
            }));
          }
        }
      });
      
      // Check if we should show the generate button
      if (state.showFillButton.image && state.showFillButton.qr) {
        const fillButton = document.getElementById("fillImageButton");
        if (fillButton) {
          fillButton.style.display = "block";
        }
      }
    } catch (error) {
      console.error("Error extracting images:", error);
    }
  };

  // Intelligent background removal algorithm
  const intelligentBackgroundRemoval = async (
    imageSrc: string, 
    threshold = 40, 
    bgColor: { r: number, g: number, b: number }, 
    edgeThreshold = 10
  ): Promise<string> => {
    return new Promise((resolve) => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const image = new Image();
      image.crossOrigin = "Anonymous";

      image.onload = () => {
        if (!ctx) {
          resolve("");
          return;
        }
        
        canvas.width = image.width;
        canvas.height = image.height;
        ctx.drawImage(image, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        const selectedBgColor = bgColor || { r: data[0], g: data[1], b: data[2] };

        const colorDistance = (r: number, g: number, b: number) => Math.sqrt(
          Math.pow(r - selectedBgColor.r, 2) +
          Math.pow(g - selectedBgColor.g, 2) +
          Math.pow(b - selectedBgColor.b, 2)
        );

        const edges = detectEdges(data, canvas.width, canvas.height, edgeThreshold);

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2];

          if (colorDistance(r, g, b) < threshold && !edges[i / 4]) {
            data[i + 3] = 0; // Set alpha to 0 (transparent)
          }
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      };

      image.src = imageSrc;
    });
  };

  // Edge detection helper for background removal
  const detectEdges = (data: Uint8ClampedArray, width: number, height: number, threshold: number): boolean[] => {
    const edgeMap = new Array(width * height).fill(false);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = (y * width + x) * 4;
        const gx = getGradient(data, width, x, y, "x");
        const gy = getGradient(data, width, x, y, "y");
        const gradientMagnitude = Math.sqrt(gx * gx + gy * gy);

        if (gradientMagnitude > threshold) {
          edgeMap[y * width + x] = true;
        }
      }
    }
    return edgeMap;
  };

  // Gradient calculation helper
  const getGradient = (data: Uint8ClampedArray, width: number, x: number, y: number, direction: string): number => {
    const offset = direction === "x" ? 1 : width;
    const p1 = data[(y * width + x) * 4] - data[(y * width + x - offset) * 4];
    const p2 = data[(y * width + x + offset) * 4] - data[(y * width + x) * 4];
    return (p1 + p2) / 2;
  };

  // RGB to Hex color conversion
  const rgbToHex = (r: number, g: number, b: number): string => {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  };

  // Hex to RGB color conversion
  const hexToRgb = (hex: string): { r: number, g: number, b: number } => {
    const bigint = parseInt(hex.slice(1), 16);
    return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
  };

  // Handle showing the image editing modal
  const handleUserPicClick = () => {
    if (originalImageSrc) {
      setShowModal(true);
      setTimeout(() => {
        const img = document.getElementById("imageToCrop") as HTMLImageElement;
        if (img) {
          img.src = savedImageData || originalImageSrc;
          
          // Initialize Cropper.js
          if (cropperRef.current) {
            cropperRef.current.destroy();
          }
          
          cropperRef.current = new Cropper(img, {
            aspectRatio: 0.78,
            viewMode: 1,
          });
        }
      }, 100);
    }
  };

  // Update background removal preview
  const updatePreview = async () => {
    const thresholdInput = document.getElementById("bgThreshold") as HTMLInputElement;
    const threshold = parseInt(thresholdInput?.value || "40", 10);
    const previewImageData = await intelligentBackgroundRemoval(
      savedImageData || originalImageSrc, threshold, selectedColor, 10
    );

    const img = document.getElementById("imageToCrop") as HTMLImageElement;
    if (img) {
      img.src = previewImageData;
    
      // Reinitialize cropper
      if (cropperRef.current) {
        cropperRef.current.destroy();
      }
      
      cropperRef.current = new Cropper(img, {
        aspectRatio: 0.78,
        viewMode: 1,
      });
    }
  };

  // Handle save background removal changes
  const handleSaveRemoval = async () => {
    const thresholdInput = document.getElementById("bgThreshold") as HTMLInputElement;
    const threshold = parseInt(thresholdInput?.value || "40", 10);
    const newSavedData = await intelligentBackgroundRemoval(
      savedImageData || originalImageSrc, threshold, selectedColor, 10
    );
    setSavedImageData(newSavedData);
    
    setState(prev => ({
      ...prev,
      selectedImageCroped: newSavedData
    }));
    
    toast.success("Background removal changes saved");
  };

  // Handle confirming the cropped image
  const handleConfirmCrop = async () => {
    if (cropperRef.current) {
      const croppedCanvas = cropperRef.current.getCroppedCanvas();
      const croppedImageDataURL = croppedCanvas.toDataURL("image/png");

      const thresholdInput = document.getElementById("bgThreshold") as HTMLInputElement;
      const threshold = parseInt(thresholdInput?.value || "40", 10);
      const finalImageData = await intelligentBackgroundRemoval(
        croppedImageDataURL, threshold, selectedColor, 10
      );
      
      setState(prev => ({
        ...prev,
        selectedImageCroped: finalImageData
      }));
      
      setShowModal(false);
    }
  };

  // Handle generating the PDF
  const handleGeneratePDF = async () => {
    if (!state.selectedImageCroped) {
      toast.error("Please select an image first!");
      return;
    }

    try {
      setIsLoading(true);

      // Determine which PDF template to use based on mode
      const pdfPath = courseMode === "aggiornamenti" 
        ? "/outputCard Renewal.pdf" 
        : "/outputCard v3.1.pdf";

      // Fetch required assets
      const existingPdfBytes = await fetch(`${pdfPath}?${Date.now()}`).then(res => res.arrayBuffer());
      const fontBytes = await fetch(`/librefranklin-semibold.ttf`).then(res => res.arrayBuffer());
      const imageBytes = await fetch(state.selectedImageCroped).then(res => res.arrayBuffer());
      const qrCodeBytes = await fetch(state.qr_code).then(res => res.arrayBuffer());

      // Load and modify PDF
      const pdfDoc = await PDFDocument.load(existingPdfBytes);
      pdfDoc.registerFontkit(fontkit);
      const customFont = await pdfDoc.embedFont(fontBytes);

      const image = await pdfDoc.embedPng(imageBytes);
      let qrCodeImage;
      if (state.qr_code) {
        qrCodeImage = await pdfDoc.embedPng(qrCodeBytes);
      }

      const form = pdfDoc.getForm();
      const p2_name_description = state.name_description.slice(-16);

      // Update text fields
      const updateTextField = (fieldName: string, textValue: string) => {
        const textField = form.getTextField(fieldName);
        if (textField) {
          textField.setText(textValue);
          textField.updateAppearances(customFont);
        }
      };

      updateTextField("p1_name", state.name);
      updateTextField("p1_name_description", state.name_description);
      updateTextField("p1_date_1", state.date_1);
      updateTextField("p1_date_2", state.date_2);
      updateTextField("p1_date_bottom_1", state.bottom_date_1);
      updateTextField("p1_date_bottom_2", state.bottom_date_2);
      updateTextField("p2_attestation_number", state.attestation_number);
      updateTextField("p2_name", state.name);
      updateTextField("p2_name_description", p2_name_description);
      updateTextField("p2_date_bottom_1", state.bottom_date_1);
      updateTextField("p2_date_bottom_2", state.bottom_date_2);

      // Set images
      form.getButton("p1_user_pic").setImage(image);
      if (qrCodeImage) {
        form.getButton("p2_qr").setImage(qrCodeImage);
      }

      form.flatten();
      pdfDoc.setTitle(state.name.trim().toLowerCase().replace(/\s+/g, '_'));

      // Save and download PDF
      const pdfBytesModified = await pdfDoc.save();
      const blob = new Blob([pdfBytesModified], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      const downloadLink = document.createElement('a');
      downloadLink.href = url;
      downloadLink.download = `${state.name.trim().toLowerCase().replace(/\s+/g, '_')}_${Date.now()}_output.pdf`;
      downloadLink.click();

      setIsLoading(false);
      toast.success("PDF generated successfully!");
      
      // Optional: Reset form or redirect
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Failed to generate PDF");
      setIsLoading(false);
    }
  };

  // Handle input changes
  const handleInputChange = (field: keyof AppState, value: string) => {
    setState(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div className="min-h-screen bg-[#f6f8fc]">
      {/* Loader */}
      {isLoading && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      )}
      
      {/* Image Editing Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" ref={modalRef}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-4">
            <h3 className="text-lg font-semibold mb-2">Edit Image</h3>
            <div className="mb-4">
              <img id="imageToCrop" alt="Image to crop" className="max-w-full h-auto mx-auto" />
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Threshold:</Label>
                  <input 
                    type="range" 
                    id="bgThreshold" 
                    min="0" 
                    max="100" 
                    defaultValue="40"
                    onChange={updatePreview}
                    className="w-full" 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Color:</Label>
                  <input 
                    type="color" 
                    id="colorPicker" 
                    defaultValue="#ffffff"
                    onChange={(e) => setSelectedColor(hexToRgb(e.target.value))}
                    className="w-full h-9 rounded border p-1" 
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Button onClick={handleSaveRemoval}>Save Changes</Button>
                <Button onClick={handleConfirmCrop}>Confirm</Button>
                <Button variant="outline" onClick={() => setShowModal(false)}>Close</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <header className="pt-8 pb-4 text-center">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Generate PDF Cards with PDF and Image</h1>
        <p className="text-gray-700 mt-2">Seamlessly Extracting Text and Images from source PDF File and generating new Card</p>
      </header>

      <main className="container mx-auto px-4">
        <div className="bg-white rounded-xl shadow-sm p-4 md:p-6 max-w-4xl mx-auto">
          {/* Upload Section */}
          <div className="border-2 border-dashed border-[#ddddf8] rounded-xl p-4 md:p-6 text-center">
            <div className="flex flex-col items-center justify-center">
              <svg 
                width="85" 
                height="63" 
                viewBox="0 0 85 63" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
                className="mb-4"
              >
                <path d="M42.5 15L32.5 25H40V40H45V25H52.5L42.5 15Z" fill="#1E88E5"/>
                <path d="M67.5 7.5H42.5L52.5 17.5H67.5V52.5H17.5V17.5H32.5L42.5 7.5H17.5C14.75 7.5 12.5 9.75 12.5 12.5V52.5C12.5 55.25 14.75 57.5 17.5 57.5H67.5C70.25 57.5 72.5 55.25 72.5 52.5V12.5C72.5 9.75 70.25 7.5 67.5 7.5Z" fill="#1E88E5"/>
              </svg>

              <h3 className="text-xl font-medium mb-2">Upload your files</h3>
              <p className="text-gray-500 mb-6">Supported formats: JPG, PNG, JPEG, PDF</p>
              
              <div className="flex flex-wrap gap-4 justify-center">
                <div>
                  <Input
                    id="fileInput"
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Label htmlFor="fileInput" className="inline-flex h-10 bg-blue-500 text-white rounded-md px-4 py-2 cursor-pointer hover:bg-blue-600 transition-colors">
                    Select PDF
                  </Label>
                </div>
                
                <div>
                  <Input
                    id="imageInput"
                    type="file"
                    accept="image/jpg, image/jpeg, image/png"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <Label htmlFor="imageInput" className="inline-flex h-10 bg-blue-500 text-white rounded-md px-4 py-2 cursor-pointer hover:bg-blue-600 transition-colors">
                    Select Image
                  </Label>
                </div>
              </div>
              
              <div className="mt-6 w-full max-w-xs">
                <Label htmlFor="modeSelect" className="mb-2 block">Course:</Label>
                <Select value={courseMode} onValueChange={(value) => setCourseMode(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select course type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="aggiornamenti">Aggiornamenti</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Content Container - Initially Hidden */}
          <div id="container" className={`mt-6 border border-[#dddfff] rounded-lg p-4 ${(state.showFillButton.image || state.showFillButton.qr) ? 'block' : 'hidden'}`}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Form Fields Section */}
              <div id="docs" className="space-y-4">
                <div className="space-y-2">
                  <Label className="font-bold">Name</Label>
                  <Input 
                    value={state.name} 
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className="border-gray-400"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold">Name Description</Label>
                  <Input 
                    value={state.name_description}
                    onChange={(e) => handleInputChange('name_description', e.target.value)}
                    className="border-gray-400"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold">Date 1</Label>
                  <Input 
                    value={state.date_1}
                    onChange={(e) => handleInputChange('date_1', e.target.value)}
                    className="border-gray-400"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold">Date 2</Label>
                  <Input 
                    value={state.date_2}
                    onChange={(e) => handleInputChange('date_2', e.target.value)}
                    className="border-gray-400"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold">Bottom Date 1</Label>
                  <Input 
                    value={state.bottom_date_1}
                    onChange={(e) => handleInputChange('bottom_date_1', e.target.value)}
                    className="border-gray-400"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold">Bottom Date 2</Label>
                  <Input 
                    value={state.bottom_date_2}
                    onChange={(e) => handleInputChange('bottom_date_2', e.target.value)}
                    className="border-gray-400"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold">Attestation Number</Label>
                  <Input 
                    value={state.attestation_number}
                    onChange={(e) => handleInputChange('attestation_number', e.target.value)}
                    className="border-gray-400"
                  />
                </div>
              </div>
              
              {/* Images Section */}
              <div id="Images" className="flex flex-col md:items-end gap-4">
                <div id="user_pic" onClick={handleUserPicClick} className="cursor-pointer">
                  {state.selectedImageCroped && (
                    <img 
                      src={state.selectedImageCroped} 
                      id="selectedImage" 
                      alt="Selected Image"
                      className="max-w-[140px] md:max-w-[160px] h-auto border border-gray-300 rounded-md"
                    />
                  )}
                  {!state.selectedImageCroped && <div className="w-32 h-40 bg-gray-100 rounded flex items-center justify-center text-gray-400">No Image</div>}
                </div>
                
                <div id="qr_code">
                  {state.qr_code && (
                    <img 
                      src={state.qr_code} 
                      alt="QR Code"
                      className="max-w-[140px] md:max-w-[160px] h-auto border border-gray-300 rounded-md"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* Generate Button */}
          <div className="text-center mt-8">
            <Button 
              id="fillImageButton" 
              onClick={handleGeneratePDF}
              disabled={!state.showFillButton.image || !state.showFillButton.qr || isLoading}
              className={`bg-blue-500 hover:bg-blue-600 text-white px-8 py-2 rounded ${(state.showFillButton.image && state.showFillButton.qr) ? 'block' : 'hidden'} mx-auto min-w-[200px]`}
            >
              {isLoading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </span>
              ) : "Generate Card"}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;

