
import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import BackgroundRemover from '@/components/BackgroundRemover';
import { Loader2 } from "lucide-react";
import { PDFDocument } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import * as pdfjsLib from 'pdfjs-dist';

// Set up PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@2/build/pdf.worker.js';

const Index = () => {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const modeSelectRef = useRef<HTMLSelectElement>(null);
  
  // PDF state
  const [pdfData, setPdfData] = useState({
    docs: [],
    name: "",
    name_description: "",
    date_1: "",
    date_2: "",
    bottom_date_1: "",
    bottom_date_2: "",
    qr_code: "",
    attestation_number: "",
  });
  const [showFillButton, setShowFillButton] = useState({ image: false, qr: false });
  
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
      const result = e.target?.result as string;
      setOriginalImage(result);
      setShowFillButton(prev => ({ ...prev, image: true }));
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
    setPdfData({
      docs: [],
      name: "",
      name_description: "",
      date_1: "",
      date_2: "",
      bottom_date_1: "",
      bottom_date_2: "",
      qr_code: "",
      attestation_number: "",
    });
    setShowFillButton({ image: false, qr: false });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (pdfInputRef.current) {
      pdfInputRef.current.value = '';
    }
  };

  // PDF handling functions
  const handlePdfFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const docName = file.name;
    const reader = new FileReader();
    reader.onload = (e) => {
      const typedArray = new Uint8Array(e.target?.result as ArrayBuffer);
      loadPDF(typedArray, docName);
    };
    reader.readAsArrayBuffer(file);
  };

  const loadPDF = (typedArray: Uint8Array, docName: string) => {
    pdfjsLib.getDocument({ data: typedArray }).promise.then((pdf: any) => {
      const docs = [...pdfData.docs];
      const pages = [];
      const docInfo = { name: docName, pages };
      docs.push(docInfo);
      
      setPdfData(prev => ({ ...prev, docs }));

      for (let i = 1; i <= pdf.numPages; i++) {
        const pageInfo = { number: i, images: [] };
        pages.push(pageInfo);
        
        pdf.getPage(i).then((page: any) => {
          if (i === 1) {
            processPageOneContent(page);
          } else if (i === 2) {
            processPageTwoContent(page);
            processImagesFromPage(page);
          }
        });
      }
    });
  };

  const processPageOneContent = (page: any) => {
    page.getTextContent().then((textContent: any) => {
      const textItems = extractTextItems(textContent);
      
      let foundName = false;
      let foundDateLabel = false;
      let foundSedeLabel = false;
      
      textItems.forEach((item: any, index: number) => {
        if (foundName) {
          setPdfData(prev => ({ ...prev, name_description: item.text }));
          foundName = false;
        } else if (index === 2) {
          setPdfData(prev => ({ ...prev, name: item.text }));
          foundName = true;
        }

        if (!foundDateLabel && item.text.includes("DATA E ORARIO SVOLGIMENTO LEZIONE")) {
          foundDateLabel = true;
        } else if (foundDateLabel) {
          setPdfData(prev => ({ ...prev, date_1: item.text }));
          foundDateLabel = false;
        }

        if (!foundSedeLabel && item.text.includes("SEDE DI SVOLGIMENTO DEL CORSO/I")) {
          foundSedeLabel = true;
        } else if (foundSedeLabel) {
          setPdfData(prev => ({ ...prev, date_2: item.text }));
          foundSedeLabel = false;
        }
      });
    });
  };

  const processPageTwoContent = (page: any) => {
    page.getTextContent().then((textContent: any) => {
      const textItems = extractTextItems(textContent);
      const bottomDates: any[] = [];
      
      textItems.forEach((item: any) => {
        const xCoord = item.x;
        const yCoord = item.y;
        const proximityThreshold = 30;
        const targetX = 645.51656;
        const targetY = 537.021543;

        if (Math.abs(xCoord - targetX) < proximityThreshold && 
            Math.abs(yCoord - targetY) < proximityThreshold && 
            item.text.length === 10) {
          setPdfData(prev => ({ ...prev, attestation_number: item.text }));
        }

        if (yCoord < 50 && !item.text.includes("Powered by") && !item.text.includes("e s.m.i.")) {
          bottomDates.push({ text: item.text, x: xCoord });
        }
      });

      if (bottomDates.length >= 2) {
        setPdfData(prev => ({ 
          ...prev, 
          bottom_date_1: bottomDates[0].text,
          bottom_date_2: bottomDates[1].text
        }));
      }
    });
  };

  const processImagesFromPage = (page: any) => {
    const viewport = page.getViewport({ scale: 1.5 });
    page.getOperatorList().then((opList: any) => {
      const svgGfx = new pdfjsLib.SVGGraphics(page.commonObjs, page.objs);
      svgGfx.getSVG(opList, viewport).then((svg: any) => {
        const images = svg.querySelectorAll("image");
        if (images.length > 0) {
          const imgSrc = images[0].getAttribute("href") || images[0].getAttribute("xlink:href");
          if (imgSrc) {
            setPdfData(prev => ({ ...prev, qr_code: imgSrc }));
            setShowFillButton(prev => ({ ...prev, qr: true }));
          }
        }
      });
    });
  };

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

  const handleGenerateCard = async () => {
    if (!processedImage) {
      toast({
        variant: "destructive",
        title: "Missing image",
        description: "Please upload and process an image first"
      });
      return;
    }

    if (!pdfData.qr_code) {
      toast({
        variant: "destructive",
        title: "Missing QR code",
        description: "Please upload a PDF to extract the QR code"
      });
      return;
    }

    setIsLoading(true);
    toast({
      title: "Generating card",
      description: "Please wait while we prepare your card"
    });

    try {
      // Get the PDF path based on mode
      const mode = modeSelectRef.current?.value || 'normal';
      const pdfPath = mode === 'aggiornamenti' ? "outputCard Renewal.pdf" : "outputCard v3.1.pdf";
      
      // Fetch template PDF
      const existingPdfBytes = await fetch(pdfPath)
        .then(res => res.arrayBuffer())
        .catch(error => {
          console.error("Error fetching PDF template:", error);
          toast({
            variant: "destructive",
            title: "Template error",
            description: `Could not load the PDF template: ${pdfPath}`
          });
          throw error;
        });

      // Fetch font
      const fontBytes = await fetch('librefranklin-semibold.ttf')
        .then(res => res.arrayBuffer())
        .catch(error => {
          console.error("Error fetching font:", error);
          toast({
            variant: "destructive",
            title: "Font error",
            description: "Could not load the required font"
          });
          throw error;
        });

      // Load processed image and QR code
      const imageBytes = await fetch(processedImage).then(res => res.arrayBuffer());
      const qrCodeBytes = await fetch(pdfData.qr_code).then(res => res.arrayBuffer());

      // Load PDF document
      const pdfDoc = await PDFDocument.load(existingPdfBytes);
      
      // Register fontkit and embed font
      pdfDoc.registerFontkit(fontkit);
      const customFont = await pdfDoc.embedFont(fontBytes);

      // Embed images
      const image = await pdfDoc.embedPng(imageBytes);
      const qrCodeImage = await pdfDoc.embedPng(qrCodeBytes);

      // Get form and update fields
      const form = pdfDoc.getForm();
      const p2_name_description = pdfData.name_description.slice(-16);

      // Update text fields
      const updateTextField = (fieldName: string, textValue: string) => {
        try {
          const textField = form.getTextField(fieldName);
          if (textField) {
            textField.setText(textValue);
            textField.updateAppearances(customFont);
          }
        } catch (error) {
          console.warn(`Could not update field ${fieldName}:`, error);
        }
      };

      updateTextField("p1_name", pdfData.name);
      updateTextField("p1_name_description", pdfData.name_description);
      updateTextField("p1_date_1", pdfData.date_1);
      updateTextField("p1_date_2", pdfData.date_2);
      updateTextField("p1_date_bottom_1", pdfData.bottom_date_1);
      updateTextField("p1_date_bottom_2", pdfData.bottom_date_2);
      updateTextField("p2_attestation_number", pdfData.attestation_number);
      updateTextField("p2_name", pdfData.name);
      updateTextField("p2_name_description", p2_name_description);
      updateTextField("p2_date_bottom_1", pdfData.bottom_date_1);
      updateTextField("p2_date_bottom_2", pdfData.bottom_date_2);

      // Set images
      try {
        form.getButton("p1_user_pic").setImage(image);
        form.getButton("p2_qr").setImage(qrCodeImage);
      } catch (error) {
        console.error("Error setting images:", error);
        toast({
          variant: "destructive",
          title: "Image error",
          description: "Could not set images in the PDF"
        });
      }

      // Flatten form and save PDF
      form.flatten();
      
      // Set PDF title
      const safeFileName = pdfData.name.trim().toLowerCase().replace(/\s+/g, '_');
      pdfDoc.setTitle(safeFileName);

      // Save and download PDF
      const pdfBytesModified = await pdfDoc.save();
      const blob = new Blob([pdfBytesModified], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      // Download
      const downloadLink = document.createElement('a');
      downloadLink.href = url;
      downloadLink.download = `${safeFileName}_${Date.now()}_output.pdf`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);

      setIsLoading(false);
      toast({
        title: "Success!",
        description: "Your card has been generated and downloaded"
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      setIsLoading(false);
      toast({
        variant: "destructive",
        title: "Generation failed",
        description: "There was an error generating your card. Please try again."
      });
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-gray-50 to-gray-100">
      <div className="w-full max-w-4xl mx-auto">
        <div className="text-center mb-10 space-y-2">
          <h1 className="text-4xl font-medium tracking-tight">Background Remover & PDF Card Generator</h1>
          <p className="text-gray-500 max-w-xl mx-auto">
            Upload an image and PDF to create professional cards with automatic background removal.
          </p>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden p-8">
          {!originalImage ? (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row gap-4 justify-center">
                <div className="flex-1">
                  <h2 className="text-lg font-medium mb-3">Upload Image</h2>
                  <div className="flex flex-col items-center justify-center min-h-[200px] border-2 border-dashed border-gray-200 rounded-lg p-8">
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
                </div>
                
                <div className="flex-1">
                  <h2 className="text-lg font-medium mb-3">Upload PDF</h2>
                  <div className="flex flex-col items-center justify-center min-h-[200px] border-2 border-dashed border-gray-200 rounded-lg p-8">
                    <input
                      type="file"
                      onChange={handlePdfFile}
                      accept="application/pdf"
                      className="hidden"
                      ref={pdfInputRef}
                    />
                    <Button 
                      className="bg-blue-500 hover:bg-blue-600 transition-colors px-6 py-5 h-auto text-lg"
                      onClick={() => pdfInputRef.current?.click()}
                    >
                      Upload PDF
                    </Button>
                    <p className="text-gray-400 mt-3 text-sm">
                      Upload PDF to extract data (Max 10MB)
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-center">
                <div className="w-full max-w-xs">
                  <label htmlFor="modeSelect" className="block text-sm font-medium mb-2">Card Type:</label>
                  <select 
                    id="modeSelect" 
                    ref={modeSelectRef}
                    className="w-full p-2 border border-gray-300 rounded-md"
                    defaultValue="normal"
                  >
                    <option value="normal">Normal</option>
                    <option value="aggiornamenti">Aggiornamenti</option>
                  </select>
                </div>
              </div>
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
              
              {pdfData.name && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h2 className="text-lg font-medium mb-3">Extracted PDF Data</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p><strong>Name:</strong> {pdfData.name}</p>
                      <p><strong>Description:</strong> {pdfData.name_description}</p>
                      <p><strong>Date 1:</strong> {pdfData.date_1}</p>
                      <p><strong>Date 2:</strong> {pdfData.date_2}</p>
                    </div>
                    <div>
                      <p><strong>Bottom Date 1:</strong> {pdfData.bottom_date_1}</p>
                      <p><strong>Bottom Date 2:</strong> {pdfData.bottom_date_2}</p>
                      <p><strong>Attestation #:</strong> {pdfData.attestation_number}</p>
                      {pdfData.qr_code && (
                        <div className="mt-2">
                          <p><strong>QR Code:</strong></p>
                          <img 
                            src={pdfData.qr_code} 
                            alt="QR Code" 
                            className="w-20 h-20 object-contain"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
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
                
                {processedImage && pdfData.qr_code && (
                  <Button 
                    className="bg-green-500 hover:bg-green-600 transition-colors"
                    onClick={handleGenerateCard}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : 'Generate Card'}
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
