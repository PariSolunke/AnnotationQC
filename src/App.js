import logo from './logo.svg';
import React, { useState, useEffect } from 'react';
import './App.css';
import Papa from 'papaparse';

function App() {
  const [message, setMessage] = useState('');
  const [showMessage, setShowMessage] = useState(false);

  const [images, setImages] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [opacity, setOpacity] = useState(0.4);
  const [csvData, setCsvData] = useState([]);
  const [imageURL, setImageURL] = useState(null);
  const [annotationURL, setAnnotationURL] = useState(null);
  const [folderHandle, setFolderHandle] = useState(null);


  useEffect(() => {
    if (showMessage) {
      const timer = setTimeout(() => {
        setShowMessage(false);
      }, 1000); // Hide message after 2 seconds

      return () => clearTimeout(timer);
    }
  }, [showMessage]);


  // Function to allow user to pick a folder and scan it
  const handleFolderSelect = async () => {
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
        // If the file does not exist, we don't need to do anything here
      }
  
      // Iterate through the 'images' folder and get corresponding annotation files
      for await (const entry of imagesFolder.values()) {
        if (entry.kind === 'file' && entry.name.endsWith('.png')) {
          try {
            const annotationHandle = await annotationsFolder.getFileHandle(entry.name, { create: false });
            imageFiles.push({ image: entry, annotation: annotationHandle });
          } catch (error) {
            console.warn(`Annotation for ${entry.name} not found. Skipping this image.`);
          }
        }
      }
  
      setImages(imageFiles);
      await loadFiles(imageFiles[0]); // Load the first image
    } catch (err) {
      console.error("Error selecting folder: ", err);
    }
  };

  const loadFiles = async (filePair) => {
    if (!filePair) return;

    // Revoke previous object URLs to free up memory
    if (imageURL) URL.revokeObjectURL(imageURL);
    if (annotationURL) URL.revokeObjectURL(annotationURL);

    // Load the image
    const imageFile = await filePair.image.getFile();
    const newImageURL = URL.createObjectURL(imageFile);
    setImageURL(newImageURL);

    // Load the corresponding annotation file
    const annotationFile = await filePair.annotation.getFile();
    const newAnnotationURL = URL.createObjectURL(annotationFile);
    setAnnotationURL(newAnnotationURL);
  };

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

  const handleMatch = () => {
    saveResult('good');
    setMessage('Updated: Match');
    setShowMessage(true);

  };

  const handleMismatch = () => {
    saveResult('bad');
    setMessage('Updated: Mismatch');
    setShowMessage(true);
  };

  return (
    <div className="App">
      <h1>Annotation Quality Labeller</h1>

      <div>
        <button onClick={handleFolderSelect}>Select Folder</button>
      </div>

      {folderHandle && (
        <>
          <div className="image-container">
            {imageURL && <img src={imageURL} alt="current" style={{ opacity: 1 }} />}
            {annotationURL && <img src={annotationURL} alt="mask" className="annotation-mask" style={{ opacity: opacity }} />}
          </div>
          
   
          <div>
            <label>Mask Opacity: {Math.round(opacity * 100)}%</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={opacity}
              onChange={(e) => setOpacity(e.target.value)}
            />
          </div>

          <div className="controls">
            <button onClick={handlePrevious} disabled={currentIndex === 0} aria-label="Previous">
              &#9664; {/* Left arrow symbol */}
            </button>
            <button onClick={handleNext} disabled={currentIndex === images.length - 1} aria-label="Next">
              &#9654; {/* Right arrow symbol */}
            </button>
          </div>

          <div className="evaluation">
            <button onClick={handleMatch}>Match</button>
            <button onClick={handleMismatch}>Mismatch</button>
          </div>

          {showMessage && (
            <div className="message">{message}</div>
          )}
        </>
      )}
    </div>
  );
}

export default App;
