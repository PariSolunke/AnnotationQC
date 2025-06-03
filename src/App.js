import React, { useState, useEffect, useRef, useCallback } from 'react';
//import Papa from 'papaparse';
import ImagePreview from './components/ImagePreview';
import './App.css';
import SearchResults from './components/SearchResults';
import DrawingControls from './components/DrawingControls';

function App() {
  const [folderHandle, setFolderHandle] = useState(null);
  const [images, setImages] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imageURLs, setImageURLs] = useState({
    satellite: null,
    mask: null,
    overlay: null,
  });
  const [opacity, setOpacity] = useState(0.65);
  //const [csvData, setCsvData] = useState([]);

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
  
  const handleMouseDown = (e) => {
    e.preventDefault();
    if(interactionMode === 'draw'){

      if (!drawingTool) return;
      const canvas = maskCanvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
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
          
          if (distance < 15 && polygonPoints.length > 2) {
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
        const ctx = canvas.getContext('2d');
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fillStyle = drawingTool === 'eraser' ? 'black' : drawingColor;
        ctx.fill();
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
      setSelectedRegion({
        startX: e.clientX - rect.left,
        startY: e.clientY - rect.top,
        endX: e.clientX - rect.left,
        endY: e.clientY - rect.top,
      });
      setIsSelecting(true);
    }
  }

  const handleMouseMove = useCallback((e) => {
    e.preventDefault(); 

    if(interactionMode === 'draw'){
      const canvas = maskCanvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // Handle polygon preview
      if (drawingTool === 'polygon' && isDrawingPolygon && e.target.id === "mask_canvas") {
        setTempPolygonPoint({x, y});
        drawPolygonPreview();
        return;
      }

      if (!isDrawing || !drawingTool || e.target.id !== "mask_canvas") return;

      const ctx = canvas.getContext('2d');
      
      if (drawingTool === 'rectangle') {
        const tempCtx = regionCanvasRefMask.current.getContext('2d');
        tempCtx.clearRect(0, 0, canvas.width, canvas.height);
        tempCtx.strokeStyle = drawingColor;
        tempCtx.lineWidth = 2;
        tempCtx.strokeRect(drawingStartPos.x, drawingStartPos.y, x - drawingStartPos.x, y - drawingStartPos.y);
      } else if (drawingTool === 'brush' || drawingTool === 'eraser') {
        ctx.beginPath();
        ctx.lineWidth = 10;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
        ctx.lineTo(x, y);
        ctx.strokeStyle = drawingTool === 'eraser' ? 'black' : drawingColor;
        ctx.stroke();

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
      setSelectedRegion((prev) => ({
        ...prev,
        endX: e.clientX - rect.left,
        endY: e.clientY - rect.top,
      }));
    }
    
  }, [isSelecting, isDrawing, interactionMode, drawingTool, isDrawingPolygon, polygonPoints, tempPolygonPoint]);


  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsSelecting(false);
      setIsDrawing(false);
      // Note: Don't reset polygon drawing on global mouse up
    };
    
    // Prevent text selection while drawing
    const handleSelectDrawStart = (e) => {
      if (isSelecting || isDrawing || isDrawingPolygon) {
        e.preventDefault();
        return false;
      }
    };
    
    // Handle ESC key to cancel polygon drawing
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isDrawingPolygon) {
        // Cancel polygon drawing
        setPolygonPoints([]);
        setIsDrawingPolygon(false);
        setTempPolygonPoint(null);
        
        const canvas = regionCanvasRefMask.current;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };
    
    window.addEventListener('mouseup', handleGlobalMouseUp);
    document.addEventListener('selectstart', handleSelectDrawStart);
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('selectstart', handleSelectDrawStart);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSelecting, isDrawing, isDrawingPolygon]);
  
  // Function to draw the polygon preview
  const drawPolygonPreview = useCallback(() => {
    if (!isDrawingPolygon || polygonPoints.length === 0) return;
    
    const canvas = regionCanvasRefMask.current;
    const ctx = canvas.getContext('2d');
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = drawingColor;
    ctx.fillStyle = drawingColor;
    ctx.lineWidth = 2;
    
    // Draw lines between points
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
    
    // Draw circles at each point
    for (const point of polygonPoints) {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Draw special indicator for first point (shows where to click to complete)
    if (polygonPoints.length > 2) {
      ctx.strokeStyle = '#ff0000'; // Red color for completion indicator
      ctx.beginPath();
      ctx.arc(polygonPoints[0].x, polygonPoints[0].y, 8, 0, Math.PI * 2);
      ctx.stroke();
    }
  }, [isDrawingPolygon, polygonPoints, tempPolygonPoint, drawingColor]);

  // Function to complete the polygon and fill it
  const completePolygon = useCallback(() => {
    if (polygonPoints.length < 3) return;
    
    const canvas = maskCanvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Fill the polygon
    ctx.fillStyle = drawingColor;
    ctx.beginPath();
    ctx.moveTo(polygonPoints[0].x, polygonPoints[0].y);
    
    for (let i = 1; i < polygonPoints.length; i++) {
      ctx.lineTo(polygonPoints[i].x, polygonPoints[i].y);
    }
    
    ctx.closePath();
    ctx.fill();
    
    // Reset polygon drawing
    setPolygonPoints([]);
    setIsDrawingPolygon(false);
    setTempPolygonPoint(null);
    
    // Clear the preview canvas
    const previewCtx = regionCanvasRefMask.current.getContext('2d');
    previewCtx.clearRect(0, 0, canvas.width, canvas.height);
  }, [polygonPoints, drawingColor]);

  function handleMouseUp(e) {
    if(interactionMode === 'draw') {
      e.preventDefault();

      // Don't handle mouse up for polygon tool (it's handled in mouse down)
      if (drawingTool === 'polygon') {
        return;
      }

      if (!isDrawing || !drawingTool) return;
    
      const canvas = maskCanvasRef.current;
      const ctx = canvas.getContext('2d');
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      if (drawingTool === 'rectangle') {
        ctx.fillStyle = drawingColor;
        ctx.fillRect(drawingStartPos.x, drawingStartPos.y, x - drawingStartPos.x, y - drawingStartPos.y);
        
        // Clear the temporary canvas
        const tempCtx = regionCanvasRefMask.current.getContext('2d');
        tempCtx.clearRect(0, 0, canvas.width, canvas.height);
      }
      
      setIsDrawing(false);
    }
    else {
      e.preventDefault();
      setIsSelecting(false);
      setDrawnRegion(selectedRegion);
    }
  }

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

      const response = await fetch('http://216.165.113.209:5000/api/process-region', {
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
    if (currentIndex < images.length - 1) {
      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);
      setSearchResults([]);
      setStatus('Ready');

      await loadFiles(images[newIndex]);
    }
  };

  const handlePrevious = async () => {
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

  const onSave = async () => {
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
      
      // If you have any temporary drawing canvas, clear that too
      if (regionCanvasRefMask && regionCanvasRefMask.current) {
        const tempCtx = regionCanvasRefMask.current.getContext('2d');
        tempCtx.clearRect(0, 0, regionCanvasRefMask.current.width, regionCanvasRefMask.current.height);
      }
      
    } catch (error) {
      console.error("Error clearing the canvas:", error);
      alert("Failed to reset the canvas. See console for details.");
    }
  };
    

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
                  <label>Mask Opacity: {Math.round(opacity * 100)}%</label>
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.01"
                    value={opacity}
                    onChange={(e) => setOpacity(parseFloat(e.target.value))}
                  />
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
                  />
                  <canvas
                    className='drawing-canvas'
                    ref={regionCanvasRefMask}
                  />
                </div>
              </div>
            </div>

            <div>
              <DrawingControls 
                interactionMode={interactionMode}
                onToolChange={(tool) => {
                  if (tool == null){
                    setInteractionMode('select');

                    satelliteCanvasRef.current.style.opacity = 1;
                    overlayCanvasRef.current.style.opacity = 1;
                    setDrawingTool(tool);
                  }
                  else{


                    console.log('Drawing tool selected:', tool);
                    setDrawingTool(tool);
                    console.log("setting interaction mode")
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