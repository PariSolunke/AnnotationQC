import React, { useState, useEffect, useRef, useCallback } from 'react';
import Papa from 'papaparse';
import ImagePreview from './components/ImagePreview';
import './App.css';
import SearchResults from './components/SearchResults';
import DrawingControls from './components/DrawingControls';
import { flushSync } from 'react-dom';

function App() {
  const [folderHandle, setFolderHandle] = useState(null);
  const [message, setMessage] = useState('');
  const [showMessage, setShowMessage] = useState(false);
  const [images, setImages] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imageURLs, setImageURLs] = useState({
    satellite: null,
    mask: null,
    overlay: null,
  });
  const [opacity, setOpacity] = useState(0.65);
  const [csvData, setCsvData] = useState([]);

  const [selectedRegion, setSelectedRegion] = useState({
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0,
  });

  const lastPosRef = useRef({ x: 0, y: 0 });

  
  const [polygonPoints, setPolygonPoints] = useState([]);
  const [isDrawingPolygon, setIsDrawingPolygon] = useState(false);
  const [tempPolygonPoint, setTempPolygonPoint] = useState(null);
  const [isSelecting, setIsSelecting] = useState(false);

  const [interactionMode, setInteractionMode] = useState('select');
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingTool, setDrawingTool] = useState(null);
  const [drawingColor, setDrawingColor] = useState('blue');
  const [drawingStartPos, setDrawingStartPos] = useState({ x: 0, y: 0 });
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 });

  // Store all drawing operations
  const [drawingOperations, setDrawingOperations] = useState([]);
  const [currentStroke, setCurrentStroke] = useState(null); // For brush/eraser strokes in progress

  const [status, setStatus] = useState('Ready');
  const [searchResults, setSearchResults] = useState([]); 
  const [drawnRegion, setDrawnRegion] = useState({
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0,
  });

  const satelliteCanvasRef = useRef(null);
  const maskCanvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const regionCanvasRefSat = useRef(null); // Separate canvas for region drawing
  const regionCanvasRefOverlay = useRef(null); 
  const regionCanvasRefMask = useRef(null); 
  
  const loadFiles = useCallback(async (filePair) => {
    if (!filePair) return;
  
    try {
      const satelliteFile = await filePair.image.getFile();
      const annotationFile = await filePair.annotation.getFile();
  
      setImageURLs({
        satellite: URL.createObjectURL(satelliteFile),
        mask: URL.createObjectURL(annotationFile),
        overlay: URL.createObjectURL(satelliteFile), // initially overlay is satellite
      });
    } catch (error) {
      console.error("Error loading files:", error);
    }
  }, []);


  const handleFolderSelect = useCallback(async () => {
    try {
      const handle = await window.showDirectoryPicker();
      setFolderHandle(handle);
  
      const imageFiles = [];
      const annotationsFolder = await handle.getDirectoryHandle('annotations', { create: false });
      const imagesFolder = await handle.getDirectoryHandle('images', { create: false });
      
      // Check if the annotation_quality.csv file exists
      let csvFileHandle;
      try { 
        csvFileHandle = await handle.getFileHandle('annotation_quality.csv', { create: false });
        const file = await csvFileHandle.getFile();
        const fileText = await file.text();
        const parsedCsvData = Papa.parse(fileText, { header: true }).data; // Parse the CSV file
  
        setCsvData(parsedCsvData); // Load the parsed data into state
        console.log("Loaded existing CSV data:", parsedCsvData);
      } catch (error) {
        console.warn("annotation_quality.csv file not found. A new one will be created.");
      }

      for await (const entry of annotationsFolder.values()) {
        if (entry.kind === 'file' && entry.name.endsWith('.png')) {
          try {
            const imageHandle = await imagesFolder.getFileHandle(entry.name, { create: false });
            imageFiles.push({ annotation: entry, image: imageHandle });
          } catch (error) {
            console.warn(`Image for Annotation ${entry.name} not found. Skipping this image.`);
          }
        }
      }

      setImages(imageFiles);
      if (imageFiles.length > 0) {
        await loadFiles(imageFiles[0]); // Load the first image set
      }
    } catch (err) {
      console.error("Error selecting folder: ", err);
    }
  }, [loadFiles]); // Add loadFiles as a dependency

  const saveResult = async (status) => {
    const currentImage = images[currentIndex].image.name;
    const existingEntryIndex = csvData.findIndex(entry => entry.Image === currentImage);
  
    let updatedData;
  
    if (existingEntryIndex === -1) {
      // Create new entry if it doesn't exist
      const newEntry = { Image: currentImage, Status: status };
      updatedData = [...csvData, newEntry];
    } else {
      // Modify existing entry
      updatedData = csvData.map((entry, index) => 
        index === existingEntryIndex ? { ...entry, Status: status } : entry
      );
    }

    setCsvData(updatedData);
    const csvContent = Papa.unparse(updatedData);
    try {
      const fileHandle = await folderHandle.getFileHandle('annotation_quality.csv', { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(csvContent);
      await writable.close();
    } catch (err) {
      console.error("Error writing CSV file: ", err);
    }
    
  };

  useEffect(() => {
    if (showMessage) {
      const timer = setTimeout(() => {
        setShowMessage(false);
      }, 1000); // Hide message after 2 seconds

      return () => clearTimeout(timer);
    }
  }, [showMessage]);

  const handleMatch = () => {
    saveResult('good');
    setMessage('Updated Status: Match');
    setShowMessage(true);

  };

  const handleMismatch = () => {
    saveResult('bad');
    setMessage('Updated Status: Mismatch');
    setShowMessage(true);
  };

  const drawRegionCanvas = useCallback(() => {
    const regionCanvases = [
      regionCanvasRefSat.current,
      regionCanvasRefOverlay.current,
      regionCanvasRefMask.current,
    ];
    const { startX, startY, endX, endY } = selectedRegion;
  
    regionCanvases.forEach((canvas) => {
      if (!canvas) return;
  
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
  
      if (isSelecting) {
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 2;
        ctx.strokeRect(startX, startY, endX - startX, endY - startY);
      } else if (drawnRegion) {
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 2;
        ctx.strokeRect(
          drawnRegion.startX,
          drawnRegion.startY,
          drawnRegion.endX - drawnRegion.startX,
          drawnRegion.endY - drawnRegion.startY
        );
      }
    });
  }, [selectedRegion, isSelecting, drawnRegion]);
  
  const handleWheel = useCallback((e) => {
  if (interactionMode !== 'draw') return;
  e.stopPropagation();
  e.preventDefault();
  
  const canvas = e.target;
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  
  // Convert mouse position to image coordinates before zoom
  const imageX = (mouseX - panOffset.x) / zoomLevel;
  const imageY = (mouseY - panOffset.y) / zoomLevel;
  
  // Determine zoom direction and factor
  const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
  const newZoomLevel = Math.max(0.1, Math.min(5, zoomLevel * zoomFactor));
  
  // Calculate new pan offset to keep mouse position fixed on the image
  const newPanOffsetX = mouseX - imageX * newZoomLevel;
  const newPanOffsetY = mouseY - imageY * newZoomLevel;
  
  setZoomLevel(newZoomLevel);
  setPanOffset({ x: newPanOffsetX, y: newPanOffsetY });
  
  // Redraw the canvas with new zoom/pan
  redrawCanvas(maskCanvasRef.current, newZoomLevel, { x: newPanOffsetX, y: newPanOffsetY });
  
}, [interactionMode, zoomLevel, panOffset]);

// Function to redraw canvas with image + all drawing operations
const redrawCanvas = useCallback((canvas, zoom, offset) => {
  if (!canvas || !imageURLs.mask) return;
  
  const ctx = canvas.getContext('2d');
  const img = new Image();
  
  img.onload = () => {
    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Save the current context state
    ctx.save();
    
    // Apply zoom and pan transformations
    ctx.translate(offset.x, offset.y);
    ctx.scale(zoom, zoom);
    
    // Draw the base image
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    
    // Redraw all stored drawing operations
    redrawAllOperations(ctx);
    
    // Restore the context state
    ctx.restore();
  };
  
  img.src = imageURLs.mask;
}, [imageURLs.mask, drawingOperations]);

  const redrawAllOperations = useCallback((ctx) => {
    drawingOperations.forEach(operation => {
      ctx.save();
      
      switch (operation.type) {
        case 'brush':
        case 'eraser':
          ctx.strokeStyle = operation.color;
          ctx.lineWidth = operation.lineWidth;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          
          if (operation.points.length > 1) {
            ctx.beginPath();
            ctx.moveTo(operation.points[0].x, operation.points[0].y);
            
            for (let i = 1; i < operation.points.length; i++) {
              ctx.lineTo(operation.points[i].x, operation.points[i].y);
            }
            
            ctx.stroke();
          } else if (operation.points.length === 1) {
            // Single point (dot)
            ctx.beginPath();
            ctx.arc(operation.points[0].x, operation.points[0].y, operation.lineWidth / 2, 0, Math.PI * 2);
            ctx.fillStyle = operation.color;
            ctx.fill();
          }
          break;
          
        case 'rectangle':
          ctx.fillStyle = operation.color;
          ctx.fillRect(operation.x, operation.y, operation.width, operation.height);
          break;
          
        case 'polygon':
          if (operation.points.length >= 3) {
            ctx.fillStyle = operation.color;
            ctx.beginPath();
            ctx.moveTo(operation.points[0].x, operation.points[0].y);
            
            for (let i = 1; i < operation.points.length; i++) {
              ctx.lineTo(operation.points[i].x, operation.points[i].y);
            }
            
            ctx.closePath();
            ctx.fill();
          }
          break;
          
        case 'bridge':
          // Handle bridge operations
          ctx.strokeStyle = operation.color;
          ctx.lineWidth = operation.lineWidth;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          
          ctx.beginPath();
          ctx.moveTo(operation.startX, operation.startY);
          ctx.lineTo(operation.endX, operation.endY);
          ctx.stroke();
          break;
      }
      
      ctx.restore();
    });
  }, [drawingOperations]);

  // Function to store a completed drawing operation
  const storeDrawingOperation = useCallback((operation) => {
    setDrawingOperations(prev => [...prev, {
      ...operation,
      id: Date.now() + Math.random(), // Unique ID for each operation
      timestamp: Date.now()
    }]);
  }, []);

  // Convert screen coordinates to image coordinates
  const screenToImageCoords = useCallback((screenX, screenY) => {
    const imageX = (screenX - panOffset.x) / zoomLevel;
    const imageY = (screenY - panOffset.y) / zoomLevel;
    return { x: imageX, y: imageY };
  }, [zoomLevel, panOffset]);

  // Add panning functionality
  const handlePanStart = useCallback((e) => {
    if (interactionMode !== 'draw') return;
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) { // Middle mouse or Ctrl+shift click
      e.preventDefault();
      setIsPanning(true);
      setLastPanPoint({ x: e.clientX, y: e.clientY });
    }
  }, [interactionMode]);

  const handlePanMove = useCallback((e) => {
    if (!isPanning) return;
    
    e.preventDefault();
    const deltaX = e.clientX - lastPanPoint.x;
    const deltaY = e.clientY - lastPanPoint.y;
    
    const newPanOffset = {
      x: panOffset.x + deltaX,
      y: panOffset.y + deltaY
    };
    
    setPanOffset(newPanOffset);
    setLastPanPoint({ x: e.clientX, y: e.clientY });
    
    // Redraw canvas with new pan offset
    redrawCanvas(maskCanvasRef.current, zoomLevel, newPanOffset);
    
  }, [isPanning, lastPanPoint, panOffset, zoomLevel, redrawCanvas]);


    const drawPolygonPreview = useCallback(() => {
    if (!isDrawingPolygon || polygonPoints.length === 0) return;
    
    const canvas = regionCanvasRefMask.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Apply zoom/pan transform
    ctx.save();
    ctx.translate(panOffset.x, panOffset.y);
    ctx.scale(zoomLevel, zoomLevel);
    
    ctx.strokeStyle = drawingColor;
    ctx.fillStyle = drawingColor;
    ctx.lineWidth = 2 / zoomLevel; // Scale line width inversely to maintain consistent appearance
    
    // Draw lines between points
    if (polygonPoints.length > 0) {
      ctx.beginPath();
      ctx.moveTo(polygonPoints[0].x, polygonPoints[0].y);
      
      for (let i = 1; i < polygonPoints.length; i++) {
        ctx.lineTo(polygonPoints[i].x, polygonPoints[i].y);
      }
      
      // If we have a temp point, draw line to it
      if (tempPolygonPoint) {
        ctx.lineTo(tempPolygonPoint.x, tempPolygonPoint.y);
      }
      
      ctx.stroke();
    }
    
    // Draw circles at each point - scale the radius inversely to maintain consistent size
    const pointRadius = 4 / zoomLevel;
    for (const point of polygonPoints) {
      ctx.beginPath();
      ctx.arc(point.x, point.y, pointRadius, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Draw special indicator for first point when we can close the polygon
    if (polygonPoints.length > 2) {
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 2 / zoomLevel;
      ctx.beginPath();
      ctx.arc(polygonPoints[0].x, polygonPoints[0].y, 8 / zoomLevel, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    ctx.restore();
  }, [isDrawingPolygon, polygonPoints, tempPolygonPoint, drawingColor, zoomLevel, panOffset]);

  const completePolygon = useCallback(() => {
    if (polygonPoints.length < 3) return;
    
    // Store polygon operation
    storeDrawingOperation({
      type: 'polygon',
      points: [...polygonPoints], 
      color: drawingColor
    });
    
    // Reset polygon drawing
    setPolygonPoints([]);
    setIsDrawingPolygon(false);
    setTempPolygonPoint(null);
    
    // Clear the preview canvas
    const previewCtx = regionCanvasRefMask.current.getContext('2d');
    if (previewCtx) {
      previewCtx.clearRect(0, 0, previewCtx.canvas.width, previewCtx.canvas.height);
    }
    
    // Redraw the main canvas
    //redrawCanvas(maskCanvasRef.current, zoomLevel, panOffset);
  }, [polygonPoints, drawingColor, storeDrawingOperation, zoomLevel, panOffset, redrawCanvas]);

  //  zoom reset function
  const resetZoom = useCallback(() => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
    redrawCanvas(maskCanvasRef.current, 1, { x: 0, y: 0 });
  }, [redrawCanvas]);


  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
  
    // Handle panning first
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      handlePanStart(e);
      return;
    }
    
    if(interactionMode === 'draw'){
      if (!drawingTool) return;
      
      const canvas = maskCanvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const { x, y } = screenToImageCoords(screenX, screenY);
      
      lastPosRef.current = { x, y };

      // Handle polygon tool
      if (drawingTool === 'polygon') {
        if (!isDrawingPolygon) {
          // Start a new polygon
          setPolygonPoints([{x, y}]);
          setIsDrawingPolygon(true);
        } else {
          // Check if close to starting point to complete the polygon
          const startPoint = polygonPoints[0];
          const distance = Math.sqrt(Math.pow(x - startPoint.x, 2) + Math.pow(y - startPoint.y, 2));
          
          // Scale the threshold with zoom level for consistent feel
          const threshold = 15 / zoomLevel;
          
          if (distance < threshold && polygonPoints.length > 2) {
            // Complete polygon
            completePolygon();
          } else {
            // Add new point
            setPolygonPoints([...polygonPoints, {x, y}]);
          }
        }
        return; // Don't set isDrawing for polygon tool
      }

      setDrawingStartPos({ x, y });
      
      if (drawingTool === 'brush' || drawingTool === 'eraser') {
        // Start a new stroke
        setCurrentStroke({
          type: drawingTool,
          color: drawingTool === 'eraser' ? 'black' : drawingColor,
          lineWidth: 10,
          points: [{x, y}]
        });
      }
      
      setIsDrawing(true);
    }
    else{
      let canvas = satelliteCanvasRef.current;
    
      if (e.target.id==="overlay_canvas")
        canvas = overlayCanvasRef.current;
      else if (e.target.id==="mask_canvas")
        canvas = maskCanvasRef.current;

      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const { x, y } = screenToImageCoords(screenX, screenY);
      
      setSelectedRegion({
        startX: x,
        startY: y,
        endX: x,
        endY: y,
      });
      setIsSelecting(true);
    }
  }, [interactionMode, drawingTool, screenToImageCoords, handlePanStart, isDrawingPolygon, polygonPoints, drawingColor, zoomLevel]);

  const handleMouseMove = useCallback((e) => {
    e.preventDefault(); 
    
    // Handle panning first
    if (isPanning) {
      handlePanMove(e);
      return;
    }

    if(interactionMode === 'draw'){
      const canvas = maskCanvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const { x, y } = screenToImageCoords(screenX, screenY);
      
      // Handle polygon preview
      if (drawingTool === 'polygon' && isDrawingPolygon && e.target.id === "mask_canvas") {
        setTempPolygonPoint({x, y});
        // Call drawPolygonPreview in the next frame to ensure state is updated
        requestAnimationFrame(() => drawPolygonPreview());
        return;
      }

      if (!isDrawing || !drawingTool || e.target.id !== "mask_canvas") return;

      if (drawingTool === 'rectangle') {
        const tempCtx = regionCanvasRefMask.current.getContext('2d');
        tempCtx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Apply zoom/pan transform for preview
        tempCtx.save();
        tempCtx.translate(panOffset.x, panOffset.y);
        tempCtx.scale(zoomLevel, zoomLevel);
        
        tempCtx.strokeStyle = drawingColor;
        tempCtx.lineWidth = 2;
        tempCtx.strokeRect(drawingStartPos.x, drawingStartPos.y, x - drawingStartPos.x, y - drawingStartPos.y);
        
        tempCtx.restore();
      } else if (drawingTool === 'brush' || drawingTool === 'eraser') {
        // Add point to current stroke
        if (currentStroke) {
          const updatedStroke = {
            ...currentStroke,
            points: [...currentStroke.points, {x, y}]
          };
          setCurrentStroke(updatedStroke);
          
          // Redraw canvas with current stroke included
          redrawCanvasWithCurrentStroke(canvas, zoomLevel, panOffset, updatedStroke);
        }

        lastPosRef.current = { x, y };
      }
      return;
    } 

    else if(isSelecting){
      let canvas = satelliteCanvasRef.current;
      if (e.target.id==="overlay_canvas")
        canvas = overlayCanvasRef.current;
      else if (e.target.id==="mask_canvas")
        canvas = maskCanvasRef.current;    
      
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const { x, y } = screenToImageCoords(screenX, screenY);
      
      setSelectedRegion((prev) => ({
        ...prev,
        endX: x,
        endY: y,
      }));
    }
    
  }, [isSelecting, isDrawing, interactionMode, drawingTool, isDrawingPolygon, screenToImageCoords, panOffset, zoomLevel, isPanning, handlePanMove, currentStroke, drawPolygonPreview]);

  const handleMouseUp = useCallback((e) => {
    if(interactionMode === 'draw') {
      e.preventDefault();

      // Don't handle mouse up for polygon tool (it's handled in mouse down)
      if (drawingTool === 'polygon') {
        return;
      }

      if (!isDrawing || !drawingTool) return;
    
      const canvas = maskCanvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const { x, y } = screenToImageCoords(screenX, screenY);
      
      if (drawingTool === 'rectangle') {
        // Store rectangle operation
        storeDrawingOperation({
          type: 'rectangle',
          x: drawingStartPos.x,
          y: drawingStartPos.y,
          width: x - drawingStartPos.x,
          height: y - drawingStartPos.y,
          color: drawingColor
        });
        
        // Clear the temporary canvas
        const tempCtx = regionCanvasRefMask.current.getContext('2d');
        tempCtx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Redraw the main canvas
        //redrawCanvas(canvas, zoomLevel, panOffset);
      } else if (drawingTool === 'brush' || drawingTool === 'eraser') {
        // Store the completed stroke
        if (currentStroke) {
          storeDrawingOperation(currentStroke);
          setCurrentStroke(null);
        }
        
        // Redraw the canvas
        //redrawCanvas(canvas, zoomLevel, panOffset);
      }
      
      setIsDrawing(false);
    }
    else {
      e.preventDefault();
      setIsSelecting(false);
      setDrawnRegion(selectedRegion);
    }
  }, [interactionMode, drawingTool, isDrawing, screenToImageCoords, drawingStartPos, drawingColor, zoomLevel, panOffset, redrawCanvas, currentStroke, storeDrawingOperation, selectedRegion]);

  // Function to redraw canvas including current stroke in progress
  const redrawCanvasWithCurrentStroke = useCallback((canvas, zoom, offset, stroke) => {
    if (!canvas || !imageURLs.mask) return;
    
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      // Clear the canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Save the current context state
      ctx.save();
      
      // Apply zoom and pan transformations
      ctx.translate(offset.x, offset.y);
      ctx.scale(zoom, zoom);
      
      // Draw the base image
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Redraw all stored operations
      redrawAllOperations(ctx);
      
      // Draw current stroke in progress
      if (stroke && stroke.points.length > 0) {
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        if (stroke.points.length > 1) {
          ctx.beginPath();
          ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
          
          for (let i = 1; i < stroke.points.length; i++) {
            ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
          }
          
          ctx.stroke();
        } else {
          // Single point (dot)
          ctx.beginPath();
          ctx.arc(stroke.points[0].x, stroke.points[0].y, stroke.lineWidth / 2, 0, Math.PI * 2);
          ctx.fillStyle = stroke.color;
          ctx.fill();
        }
      }
      
      // Restore the context state
      ctx.restore();
    };
    
    img.src = imageURLs.mask;
  }, [imageURLs.mask, redrawAllOperations]);


const undoLastOperation = useCallback(async () => {
  if (drawingOperations.length === 0) return;
  
  const lastOperation = drawingOperations[drawingOperations.length - 1];
  
  // Force synchronous state update
  flushSync(() => {
    if (lastOperation.type === 'bridge') {
      setDrawingOperations(prev => prev.filter(op => op.type !== 'bridge'));
    } else {
      setDrawingOperations(prev => prev.slice(0, -1));
    }
  });
  

}, [drawingOperations, redrawCanvas, zoomLevel, panOffset]);


  // Function to clear all drawing operations
  const clearAllOperations = useCallback(() => {
    setDrawingOperations([]);
    redrawCanvas(maskCanvasRef.current, zoomLevel, panOffset);
  }, [redrawCanvas, zoomLevel, panOffset]);

// Function to remove specific operation by ID
  const removeOperation = useCallback((operationId) => {
    setDrawingOperations(prev => prev.filter(op => op.id !== operationId));
    
    // Redraw canvas without the removed operation
    setTimeout(() => {
      redrawCanvas(maskCanvasRef.current, zoomLevel, panOffset);
    }, 0);
  }, [redrawCanvas, zoomLevel, panOffset]);

  // Effect to redraw canvas when images change
  useEffect(() => {
    if (maskCanvasRef.current && imageURLs.mask) {
      redrawCanvas(maskCanvasRef.current, zoomLevel, panOffset);
    }
  }, [imageURLs.mask, zoomLevel, panOffset, redrawCanvas]);

  //  effect to handle global mouse events
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsSelecting(false);
      setIsDrawing(false);
      setIsPanning(false);
    };
    
    const handleGlobalMouseMove = (e) => {
      if (isPanning) {
        handlePanMove(e);
      }
    };
    
    const handleSelectDrawStart = (e) => {
      if (isSelecting || isDrawing || isDrawingPolygon || isPanning) {
        e.preventDefault();
        return false;
      }
    };
    
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isDrawingPolygon) {
          setPolygonPoints([]);
          setIsDrawingPolygon(false);
          setTempPolygonPoint(null);
          
          const canvas = regionCanvasRefMask.current;
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        } else {
          resetZoom();
        }
      } else if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        undoLastOperation();
      }
    };
    
    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('selectstart', handleSelectDrawStart);
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('selectstart', handleSelectDrawStart);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSelecting, isDrawing, isDrawingPolygon, isPanning, handlePanMove, resetZoom, undoLastOperation]);


  const handleQuery = useCallback(async (queryType) => {
    if (drawnRegion.startX === drawnRegion.endX && drawnRegion.startY === drawnRegion.endY) {
      setStatus('Please draw a region first.');
      return;
    }

    setStatus('Processing...');
    try {
      const canvas = queryType === 'satellite' ? satelliteCanvasRef.current : maskCanvasRef.current;
      if (!canvas) return;

      const { startX, startY, endX, endY } = drawnRegion;
      const width = Math.abs(endX - startX);
      const height = Math.abs(endY - startY);
      const x = Math.min(startX, endX);
      const y = Math.min(startY, endY);
      const regionCanvas = document.createElement('canvas');
      regionCanvas.width = width;
      regionCanvas.height = height;
      const ctx = regionCanvas.getContext('2d');
      ctx.drawImage(canvas, x, y, width, height, 0, 0, width, height);

      const regionDataUrl = regionCanvas.toDataURL('image/jpeg');
      const base64Response = await fetch(regionDataUrl);
      const blob = await base64Response.blob();
      const formData = new FormData();
      formData.append('region_image', blob, 'region.jpg');

      const response = await fetch('http://192.168.1.170:5000/api/process-region', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      //display result data
      setSearchResults(data.results); 
      setStatus(`Found ${data.results.length} results.`);
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    }
  }, [drawnRegion]);

  useEffect(() => {
    const syncRegionCanvas = (regionCanvas, imageCanvas) => {
      
      if (regionCanvas && imageCanvas) {
        // Set the region canvas to exactly match the displayed size of the image canvas
        const rect = imageCanvas.getBoundingClientRect();
        
        // Set both internal and display dimensions to match
        regionCanvas.width = imageCanvas.width;
        regionCanvas.height = imageCanvas.height;
        regionCanvas.style.width = imageCanvas.style.width;
        regionCanvas.style.height = imageCanvas.style.height;
        
        // Ensure the region canvas is positioned exactly over the image canvas
        regionCanvas.style.position = 'absolute';
        regionCanvas.style.top = '0';
        regionCanvas.style.left = '0';
        regionCanvas.style.pointerEvents = 'none';
      }
      
    };

    if (imageURLs.satellite && imageURLs.mask) {
      const loadImageAndSync = () => {
        const canvases = [
          satelliteCanvasRef.current,
          maskCanvasRef.current,
          overlayCanvasRef.current,
        ];
        const regionCanvases = [
          regionCanvasRefSat.current,
          regionCanvasRefMask.current,
          regionCanvasRefOverlay.current,
        ];
        const imageUrls = [
          imageURLs.satellite,
          imageURLs.mask,
          imageURLs.overlay,
        ];
  
        let imagesLoaded = 0;
        const totalImages = canvases.length;
  

  
        const imageLoaded = () => {
          imagesLoaded++;
          if (imagesLoaded === totalImages) {
            // Sync all region canvases after all images are loaded
            for (let i = 0; i < canvases.length; i++) {
              syncRegionCanvas(regionCanvases[i], canvases[i]);
            }
          }
        };
  
        canvases.forEach((canvas, index) => {
          if (!canvas) return;
          const ctx = canvas.getContext('2d');
          const img = new Image();
  
          img.onload = () => {
            const maxCanvasWidth = canvas.parentElement.clientWidth;
            const aspectRatio = img.width / img.height;
          
            // Set canvas style dimensions
            canvas.style.width = '100%';
            canvas.style.height = 'auto';
          
            // Set internal canvas dimensions to fit image while preserving aspect ratio
            canvas.width = maxCanvasWidth;
            canvas.height = maxCanvasWidth / aspectRatio;
          
            // Clear previous content
            ctx.clearRect(0, 0, canvas.width, canvas.height);
          
            // Draw scaled image
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          
            if (index === 2) { // For overlay canvas
              const maskImg = new Image();
              maskImg.onload = () => {
                ctx.globalAlpha = opacity;
                ctx.drawImage(maskImg, 0, 0, canvas.width, canvas.height);
                ctx.globalAlpha = 1;
              };
              maskImg.src = imageURLs.mask;
            }
          
            imageLoaded();
          };
          
          
          img.src = imageUrls[index];
        });
      };
      
      loadImageAndSync();
      
      // Add window resize listener to handle responsive behavior
      const handleResize = () => {
        if (
          satelliteCanvasRef.current && 
          maskCanvasRef.current && 
          overlayCanvasRef.current && 
          regionCanvasRefSat.current && 
          regionCanvasRefMask.current && 
          regionCanvasRefOverlay.current
        ) {
          syncRegionCanvas(regionCanvasRefSat.current, satelliteCanvasRef.current);
          syncRegionCanvas(regionCanvasRefMask.current, maskCanvasRef.current);
          syncRegionCanvas(regionCanvasRefOverlay.current, overlayCanvasRef.current);
        }
      };
      
      window.addEventListener('resize', handleResize);
      return () => {
        window.removeEventListener('resize', handleResize);
      };
    }
  }, [imageURLs, opacity]);

  useEffect(() => {
    drawRegionCanvas();
  }, [drawRegionCanvas]);

  // Navigation handlers
  const handleNext = async () => {
    await resetZoomPromise();
    setDrawingOperations([]);

    if (currentIndex < images.length - 1) {
      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);
      setSearchResults([]);
      setStatus('Ready');

      await loadFiles(images[newIndex]);
    }
  };

  const handlePrevious = async () => {
    await resetZoomPromise();
    setDrawingOperations([]);

    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      setCurrentIndex(newIndex);
      setSearchResults([]);
      setStatus('Ready');

      await loadFiles(images[newIndex]);
    }
  };

  const handlePreviewClick = async (index) => {
    if (index >= 0 && index < images.length) {
      setCurrentIndex(index);
      setSearchResults([]);
      setStatus('Ready'); 
      await loadFiles(images[index]);
    }
  };

  const handleResultClick = async (index) => {
      if (index >= 0 && index < images.length) {
        setCurrentIndex(index);
        setSearchResults([]);
        setStatus('Ready'); 
        await loadFiles(images[index]);
      }
    };

  // Helper functions for multi-type image analysis
  const getPixelRGB = (imageData, x, y) => {
    if (x < 0 || y < 0 || x >= imageData.width || y >= imageData.height) 
      return { r: 0, g: 0, b: 0 };
    
    const idx = (y * imageData.width + x) * 4;
    return {
      r: imageData.data[idx],
      g: imageData.data[idx + 1],
      b: imageData.data[idx + 2]
    };
  };

  const getPixelType = (imageData, x, y) => {
    const { r, g, b } = getPixelRGB(imageData, x, y);
    
    // Define thresholds for different pixel types
    if (r < 50 && g < 50 && b > 200) return 'sidewalk';    // Blue (0,0,255)
    if (r > 200 && g < 50 && b < 50) return 'crosswalk';   // Red (255,0,0)
    if (r < 50 && g > 100 && g < 160 && b < 50) return 'road'; // Green (0,128,0)
    if (r < 50 && g < 50 && b < 50) return 'background';   // Black (0,0,0)
    
    return 'background'; // Everything else defaults to background
  };


  const hasNeighborOfType = (imageData, x, y, targetType) => {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        if (getPixelType(imageData, x + dx, y + dy) === targetType) {
          return true;
        }
      }
    }
    return false;
  };

  const isGapBridgeable = (imageData, x1, y1, x2, y2) => {
    const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
    let roadCount = 0;
    let backgroundCount = 0;
    let sidewalkCrosswalkCount = 0;
    
    for (let i = 0; i <= steps; i++) {
      const t = steps === 0 ? 0 : i / steps;
      const x = Math.round(x1 + t * (x2 - x1));
      const y = Math.round(y1 + t * (y2 - y1));
      const pixelType = getPixelType(imageData, x, y);
      
      if (pixelType === 'road') roadCount++;
      else if (pixelType === 'background') backgroundCount++;
      else if (pixelType === 'sidewalk' || pixelType === 'crosswalk') sidewalkCrosswalkCount++;
    }
    
    const totalPixels = steps + 1;
    
    // Bridge if gap is mostly road or background, but not if it's already mostly connected
    return (roadCount + backgroundCount) / totalPixels > 0.6 && 
          sidewalkCrosswalkCount / totalPixels < 0.4;
  };


  const redrawCanvasPromise = useCallback((canvas, zoom, offset) => {
    if (!canvas || !imageURLs.mask) return Promise.resolve();
    
    return new Promise((resolve) => {
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.translate(offset.x, offset.y);
        ctx.scale(zoom, zoom);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        redrawAllOperations(ctx);
        ctx.restore();
        
        // Resolve after drawing is complete
        requestAnimationFrame(resolve);
      };
      
      img.src = imageURLs.mask;
    });
  }, [imageURLs.mask, drawingOperations]);

  const resetZoomPromise = useCallback(async () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
    
    // Wait for state updates
    await new Promise(resolve => requestAnimationFrame(resolve));
    
    // Wait for canvas redraw to complete
    await redrawCanvasPromise(maskCanvasRef.current, 1, { x: 0, y: 0 });
  }, [redrawCanvasPromise]);


  // Modified gap bridging function that stores operations
  const bridgeSidewalkCrosswalkGaps = async () => {
    await resetZoomPromise();
    const canvas = maskCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // Find all sidewalk and crosswalk pixels
    const sidewalkPixels = [];
    const crosswalkPixels = [];
    
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const pixelType = getPixelType(imageData, x, y);
        if (pixelType === 'sidewalk') {
          sidewalkPixels.push({x, y, type: 'sidewalk'});
        } else if (pixelType === 'crosswalk') {
          crosswalkPixels.push({x, y, type: 'crosswalk'});
        }
      }
    }
    
    // Find edge pixels for both types
    const sidewalkEdges = sidewalkPixels.filter(({x, y}) => {
      return hasNeighborOfType(imageData, x, y, 'road') || 
            hasNeighborOfType(imageData, x, y, 'background');
    });
    
    const crosswalkEdges = crosswalkPixels.filter(({x, y}) => {
      return hasNeighborOfType(imageData, x, y, 'road') || 
            hasNeighborOfType(imageData, x, y, 'background');
    });
    
    let bridgesCreated = 0;
    const maxGapDistance = 20;
    const minGapDistance = 3;
    
    // Store bridge operations instead of drawing directly
    const bridgeOperations = [];
    
    for (const sidewalkEdge of sidewalkEdges) {
      const {x: x1, y: y1} = sidewalkEdge;
      
      for (const crosswalkEdge of crosswalkEdges) {
        const {x: x2, y: y2} = crosswalkEdge;
        const distance = Math.sqrt((x2-x1)**2 + (y2-y1)**2);
        
        if (distance >= minGapDistance && distance <= maxGapDistance) {
          if (isGapBridgeable(imageData, x1, y1, x2, y2)) {
            // Instead of drawing directly, store the bridge operation
            bridgeOperations.push({
              type: 'bridge',
              bridgeType: 'sidewalk-crosswalk',
              startX: x1,
              startY: y1,
              endX: x2,
              endY: y2,
              color: getColorForBridgeType('sidewalk-crosswalk'), // You'll need to define this
              lineWidth: getBridgeLineWidth('sidewalk-crosswalk') // You'll need to define this
            });
            bridgesCreated++;
          }
        }
      }
    }
    
    // Store all bridge operations at once
    if (bridgeOperations.length > 0) {
      setDrawingOperations(prev => [...prev, ...bridgeOperations.map(op => ({
        ...op,
        id: Date.now() + Math.random(),
        timestamp: Date.now()
      }))]);
    }
    
    console.log(`Created ${bridgesCreated} sidewalk-crosswalk bridges!`);
  };

  /*
  // Alternative: Bridge any walkable areas (both sidewalk and crosswalk)
  const bridgeWalkableGaps = () => {
    const canvas = maskCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // Find all walkable pixels (sidewalk + crosswalk)
    const walkablePixels = [];
    
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const pixelType = getPixelType(imageData, x, y);
        if (pixelType === 'sidewalk' || pixelType === 'crosswalk') {
          walkablePixels.push({x, y, type: pixelType});
        }
      }
    }
    
    // Find edge pixels
    const edgePixels = walkablePixels.filter(({x, y}) => {
      return hasNeighborOfType(imageData, x, y, 'road') || 
            hasNeighborOfType(imageData, x, y, 'background');
    });
    
    let bridgesCreated = 0;
    const maxGapDistance = 15;
    
    // Bridge between any walkable edge pixels
    for (let i = 0; i < edgePixels.length; i++) {
      const {x: x1, y: y1, type: type1} = edgePixels[i];
      
      for (let j = i + 1; j < edgePixels.length; j++) {
        const {x: x2, y: y2, type: type2} = edgePixels[j];
        const distance = Math.sqrt((x2-x1)**2 + (y2-y1)**2);
        
        if (distance > 3 && distance <= maxGapDistance) {
          if (isGapBridgeable(imageData, x1, y1, x2, y2)) {
            // Determine bridge type
            let bridgeType = 'same';
            if (type1 !== type2) {
              bridgeType = 'sidewalk-crosswalk';
            }
            
            drawBridgeLine(ctx, x1, y1, x2, y2, bridgeType);
            bridgesCreated++;
          }
        }
      }
    }
    
    console.log(`Created ${bridgesCreated} walkable area bridges!`);
  };
  */

  const getColorForBridgeType = (bridgeType) => {
    return 'rgb(255, 0, 0)'; 
  };

  const getBridgeLineWidth = (bridgeType) => {
    return 3; 
  };

  const onSave = async () => {
    await resetZoomPromise();
    // Check if we have the necessary references
    if (!maskCanvasRef.current || !folderHandle || !images || !currentIndex) {
      console.error("Missing required references for saving");
      return;
    }
  
    try {
      // Get the current image file pair
      const currentFilePair = images[currentIndex];
      
      // Get a reference to the annotations directory
      const annotationsFolder = await folderHandle.getDirectoryHandle('annotations', { create: false });
      
      // Get the file handle for the current annotation file
      const fileHandle = await annotationsFolder.getFileHandle(currentFilePair.annotation.name, { create: false });
      
      // Convert canvas to blob
      const canvas = maskCanvasRef.current;
      const blob = await new Promise(resolve => {
        canvas.toBlob(resolve, 'image/png');
      });
      
      // Create a writable stream and write the blob data
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      
      console.log("Mask saved successfully!");
      
      // Show a success message to the user
      alert("Mask saved successfully!");
    } catch (error) {
      console.error("Error saving the mask:", error);
      alert("Failed to save the mask. See console for details.");
    }
  };

  const onClear = async () => {
    clearAllOperations();
    resetZoom();
    // Check if we have the necessary references
    if (!maskCanvasRef.current || !images || currentIndex === undefined) {
      console.error("Missing required references for clearing");
      return;
    }
    
    try {
      // Get the current image file pair
      const currentFilePair = images[currentIndex];
      
      // Get the annotation file again
      const annotationFile = await currentFilePair.annotation.getFile();
      
      // Create a new image object from the original annotation file
      const img = new Image();
      img.src = URL.createObjectURL(annotationFile);
      
      // When the image loads, draw it on the canvas
      img.onload = () => {
        const canvas = maskCanvasRef.current;
        const ctx = canvas.getContext('2d');
        
        // Clear the canvas first
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw the original annotation image
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Clean up the object URL
        URL.revokeObjectURL(img.src);
        
        console.log("Canvas cleared and reset to original annotation");
      };
      
      // clear ant temporary canvas contexts
      if (regionCanvasRefMask && regionCanvasRefMask.current) {
        const tempCtx = regionCanvasRefMask.current.getContext('2d');
        tempCtx.clearRect(0, 0, regionCanvasRefMask.current.width, regionCanvasRefMask.current.height);
      }
      
    } catch (error) {
      console.error("Error clearing the canvas:", error);
      alert("Failed to reset the canvas. See console for details.");
    }
  };


    
  useEffect(() => {
    const maskCanvas = maskCanvasRef.current;
    const regionCanvas = regionCanvasRefMask.current;

    const wheelHandler = (e) => {
      if (interactionMode === 'draw') {
        e.preventDefault(); // block scrolling
        handleWheel(e);    
      }
    };

    if (maskCanvas) {
      maskCanvas.addEventListener("wheel", wheelHandler, { passive: false });
    }
    if (regionCanvas) {
      regionCanvas.addEventListener("wheel", wheelHandler, { passive: false });
    }

    return () => {
      if (maskCanvas) {
        maskCanvas.removeEventListener("wheel", wheelHandler);
      }
      if (regionCanvas) {
        regionCanvas.removeEventListener("wheel", wheelHandler);
      }
    };
  }, [handleWheel, interactionMode]);

  return (
    <div className="App">
      <h1>Multi-Image Annotation and Similarity Search</h1>

      <div>
        <button onClick={handleFolderSelect}>Select Folder</button>
      </div>

      {folderHandle && (
        <>
          <div className="top-container">

            <ImagePreview 
              images={images}
              currentIndex={currentIndex}
              onPreviewClick={handlePreviewClick}
            />
            
            <div className="image-container">
              <div>
                <h3>Satellite Image</h3>
                <div style={{ position: 'relative' }}>
                  <canvas
                    id="satellite_canvas"
                    className="image-canvas"
                    ref={satelliteCanvasRef}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseOut={handleMouseUp}
                  />
                  <canvas
                    className='drawing-canvas'
                    ref={regionCanvasRefSat}
                  />
                </div>
              </div>

              <div>
                <h3>Overlay Image</h3>
                <div style={{ position: 'relative' }}>
                  <canvas
                    id="overlay_canvas"
                    className="image-canvas"
                    ref={overlayCanvasRef}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseOut={handleMouseUp}
                  />
                  <canvas
                    className='drawing-canvas'
                    ref={regionCanvasRefOverlay}
                  />
                </div>
                <div>
                  {interactionMode === 'select' && (
                    <>
                      <label>Mask Opacity: {Math.round(opacity * 100)}%</label>
                      <input
                        type="range"
                        min="0.1"
                        max="1"
                        step="0.01"
                        value={opacity}
                        onChange={(e) => setOpacity(parseFloat(e.target.value))}
                      />
                    </>
                    )}

                </div>
                
                
              </div>

              <div>
                <h3>Mask Image</h3>
                <div style={{ position: 'relative' }}>
                  <canvas
                    id="mask_canvas"
                    className="image-canvas"
                    ref={maskCanvasRef}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseOut={handleMouseUp}
                    style={{ cursor: isPanning ? 'grabbing' : 'default' }}
                  />
                  <canvas
                    className='drawing-canvas'
                    ref={regionCanvasRefMask}
                    style={{ 
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      pointerEvents: 'none'
                    }}
                  />
                </div>


                {interactionMode === 'draw' && (
                  <>
                  <br/>
                   In Draw Mode, move pointer to target area on mask and use scroll to zoom in/out.
                   <br />
                   Undo previous action using Ctrl+Z or Cmd+Z.
                    <br />
                    Hold shift and drag to pan in the mask.
                  </>
                )
                }
              </div>
            </div>

            <div>
              <DrawingControls 
                interactionMode={interactionMode}
                onToolChange={(tool) => {
                  if (tool == null){
                    resetZoom();
                    setInteractionMode('select');

                    satelliteCanvasRef.current.style.opacity = 1;
                    overlayCanvasRef.current.style.opacity = 1;
                    setDrawingTool(tool);
                  }
                  else{

                    setDrawingTool(tool);
                    setInteractionMode('draw');
                    satelliteCanvasRef.current.style.opacity = 0.2;
                    overlayCanvasRef.current.style.opacity = 0.2;
                    const regionCanvases = [
                      regionCanvasRefSat.current,
                      regionCanvasRefOverlay.current,
                      regionCanvasRefMask.current,
                    ];  
                    regionCanvases.forEach((canvas) => {
                      if (!canvas) return;
                      const ctx = canvas.getContext('2d');
                      ctx.clearRect(0, 0, canvas.width, canvas.height);
                    })
                  }
                }}
                onColorChange={(color, label) => {
                  console.log('Color selected:', color, label)
                  setDrawingColor(color);
                }}
                onSave={onSave}
                onClear={onClear}
                onAutoBridge={bridgeSidewalkCrosswalkGaps}
              />
            </div>

            <div></div>

            <div>

            <div className="controls">
              <button onClick={handlePrevious} disabled={currentIndex === 0}>
                Previous
              </button>
              <button onClick={handleNext} disabled={currentIndex === images.length - 1}>
                Next
              </button>

            </div>


              <div className="evaluation">
                <button onClick={handleMatch}>Report Match</button>
                <button onClick={handleMismatch}>Report Mismatch</button>
              </div>

              {showMessage && (
                <div className="message">{message}</div>
              )}

          <div className="search-controls">
            <button onClick={() => handleQuery('satellite')}>
              Query by Satellite Region
            </button>
            <button onClick={() => handleQuery('mask')}>
              Query by Mask Region
            </button>
          </div>

           <></>

            </div>
          </div>



          <SearchResults results={searchResults} status={status} images={images} opacity={opacity} handleResultClick={handleResultClick}/>

        </>
      )}
    </div>
  );
}

export default App;