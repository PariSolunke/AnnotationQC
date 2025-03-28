import React, { useState, useEffect, useRef, useCallback } from 'react';
//import Papa from 'papaparse';
import './App.css';

function App() {
  const [folderHandle, setFolderHandle] = useState(null);
  const [images, setImages] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imageURLs, setImageURLs] = useState({
    satellite: null,
    mask: null,
    overlay: null,
  });
  const [opacity, setOpacity] = useState(0.75);
  //const [csvData, setCsvData] = useState([]);

  const [selectedRegion, setSelectedRegion] = useState({
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0,
  });
  const [isDrawing, setIsDrawing] = useState(false);
  const [status, setStatus] = useState('Ready');
  const [searchResults, setSearchResults] = useState([]); // Add searchResults to state
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
      
      /*
      let csvFileHandle;
      try {
        csvFileHandle = await handle.getFileHandle('annotation_quality.csv', { create: false });
        const file = await csvFileHandle.getFile();
        const fileText = await file.text();
        const parsedCsvData = Papa.parse(fileText, { header: true }).data;
        setCsvData(parsedCsvData);
      } catch (error) {
        console.warn("annotation_quality.csv file not found. A new one will be created.");
      }
      */
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
    const canvases = [
      regionCanvasRefSat.current,
      regionCanvasRefOverlay.current,
      regionCanvasRefMask.current,
    ];
    const { startX, startY, endX, endY } = selectedRegion;
  
    canvases.forEach((canvas) => {
      if (!canvas) return;
  
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
  
      if (isDrawing) {
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
  }, [selectedRegion, isDrawing, drawnRegion]);
  
  const handleMouseDown = useCallback((e) => {
    setDrawnRegion(null);
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
    setIsDrawing(true);
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!isDrawing) return;

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
  }, [isDrawing]);

  const handleMouseUp = useCallback(() => {
    setIsDrawing(false);
    setDrawnRegion(selectedRegion);
  }, [selectedRegion]);
  

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

      const response = await fetch('http://localhost:5000/api/process-region', {
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
    if (imageURLs.satellite && imageURLs.mask) {
      const loadImageAndSync = () => {
        const canvases = [
          satelliteCanvasRef.current,
          maskCanvasRef.current,
          overlayCanvasRef.current,
        ];
        const imageUrls = [
          imageURLs.satellite,
          imageURLs.mask,
          imageURLs.overlay,
        ];

        let imagesLoaded = 0;
        const totalImages = canvases.length;

        const syncRegionCanvas = (regionRef, imageRef) => {
          if (regionRef.current && imageRef.current) {
            regionRef.current.width = imageRef.current.width;
            regionRef.current.height = imageRef.current.height;
            regionRef.current.style.position = 'absolute';
            regionRef.current.style.top = imageRef.current.offsetTop + 'px';
            regionRef.current.style.left = imageRef.current.offsetLeft + 'px';
            regionRef.current.style.pointerEvents = 'none';
          }
        };

        const imageLoaded = () => {
          imagesLoaded++;
          if (imagesLoaded === totalImages) {
            syncRegionCanvas(regionCanvasRefSat, satelliteCanvasRef);
            syncRegionCanvas(regionCanvasRefMask, maskCanvasRef);
            syncRegionCanvas(regionCanvasRefOverlay, overlayCanvasRef);
          }
        };

        canvases.forEach((canvas, index) => {
          if (!canvas) return;
          const ctx = canvas.getContext('2d');
          const img = new Image();

          img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            canvas.style.width = `${img.width}px`;
            canvas.style.height = `${img.height}px`;
            ctx.drawImage(img, 0, 0, img.width, img.height);
            if (index === 2) {
              const maskImg = new Image();
              maskImg.onload = () => {
                ctx.globalAlpha = opacity;
                ctx.drawImage(maskImg, 0, 0, img.width, img.height);
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
      await loadFiles(images[newIndex]);
    }
  };

  const handlePrevious = async () => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      setCurrentIndex(newIndex);
      await loadFiles(images[newIndex]);
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
          <div className="image-container">
            <div>
              <h3>Satellite Image</h3>
              <canvas
                id = "satellite_canvas"
                className="image-canvas"
                ref={satelliteCanvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseOut={handleMouseUp}
              />
              <canvas
                ref={regionCanvasRefSat} // Overlay canvas for region drawing
              />
            </div>

            <div>
              <h3>Overlay Image</h3>
              <canvas
                id = "overlay_canvas"
                className="image-canvas"
                ref={overlayCanvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseOut={handleMouseUp}
              />
              <canvas
                ref={regionCanvasRefOverlay} // Overlay canvas for region drawing
              />
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
              <canvas
                id = "mask_canvas"
                className="image-canvas"
                ref={maskCanvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseOut={handleMouseUp}
              />
              <canvas
                ref={regionCanvasRefMask} // Overlay canvas for region drawing
              />
            </div>
          </div>

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

          <div className="search-status">{status}</div>

          {searchResults.length > 0 && (
            <div className="search-results">
              {searchResults.map((result, index) => (
                <div key={index} className="result-item">
                  <img src={result.image_data} alt={`Result ${index}`} />
                  <p>Similarity: {result.similarity.toFixed(2)}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default App;