import React, { useState, useEffect } from 'react';
import "../styles/searchresults.css"

function SearchResults({ results, status, images, opacity, handleResultClick }) {
  const [loadedImages, setLoadedImages] = useState({});
  
  // Load images when results or images change
  useEffect(() => {
    const loadResultImages = async () => {
      const newLoadedImages = { ...loadedImages };
      
      for (const result of results) {
        // Find matching image and annotation in the images array
        const matchingIndex = findMatchingImageIndex(result.path);
        
        if (matchingIndex !== -1) {
          try {
            // Load satellite image
            if (!newLoadedImages[`satellite-${matchingIndex}`]) {
              const satelliteFile = await images[matchingIndex].image.getFile();
              newLoadedImages[`satellite-${matchingIndex}`] = URL.createObjectURL(satelliteFile);
            }
            
            // Load annotation/mask image
            if (!newLoadedImages[`mask-${matchingIndex}`]) {
              const maskFile = await images[matchingIndex].annotation.getFile();
              newLoadedImages[`mask-${matchingIndex}`] = URL.createObjectURL(maskFile);
            }
          } catch (error) {
            console.error(`Error loading images for index ${matchingIndex}:`, error);
          }
        }
      }
      
      setLoadedImages(newLoadedImages);
    };
    
    if (results.length > 0 && images.length > 0) {
      loadResultImages();
    }
    
    // Cleanup function to revoke object URLs when component unmounts
    return () => {
      Object.values(loadedImages).forEach(url => {
        URL.revokeObjectURL(url);
      });
    };
  }, [results, images]);
  
  // Function to find the index of a matching image in the images array
  const findMatchingImageIndex = (imageName) => {
    // Remove file extension to get the base name
    const baseName = imageName.split('.')[0];
    
    for (let i = 0; i < images.length; i++) {
      const filePair = images[i];
      
      if (filePair && filePair.image) {
        // Check if image name matches
        if (filePair.image.name === imageName || 
            filePair.image.name.split('.')[0] === baseName) {
          return i;
        }
      }
    }
    
    return -1; // No match found
  };

  return (
    <>
      <div className="search-status">{status}</div>

      <div className="search-results">
        {results.map((result, index) => {
          const matchingIndex = findMatchingImageIndex(result.path);
          const satelliteUrl = matchingIndex !== -1 ? loadedImages[`satellite-${matchingIndex}`] : null;
          const maskUrl = matchingIndex !== -1 ? loadedImages[`mask-${matchingIndex}`] : null;
          
          return (
            <div key={index} className="result-item" onClick={()=>{handleResultClick(matchingIndex)}}>
              <div className="result-image-container" style={{ position: 'relative' }}>
                {satelliteUrl ? (
                  <img 
                    src={satelliteUrl} 
                    alt={`Satellite ${index}`} 
                    className="satellite-image"
                    style={{ width: '100%', height: 'auto', display: 'block' }}
                  />
                ) : (
                  <div className="image-placeholder">Loading satellite image...</div>
                )}
                
                {maskUrl && (
                  <img 
                    src={maskUrl} 
                    alt={`Mask ${index}`} 
                    className="mask-overlay"
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      opacity: opacity,
                      pointerEvents: 'none'
                    }}
                  />
                )}
              </div>
              <p>Similarity: {result.similarity.toFixed(2)}</p>
            </div>
          );
        })}
      </div>
    </>
  );
}

export default SearchResults;