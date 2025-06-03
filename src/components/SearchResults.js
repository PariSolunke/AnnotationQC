import React, { useState, useEffect } from 'react';
import "../styles/searchresults.css"

function SearchResults({ results, status, images, opacity, handleResultClick }) {
  const [loadedImages, setLoadedImages] = useState({});

  // Load images when results or images change
  useEffect(() => {
    const loadResultImages = async () => {
      const newLoadedImages = {};

      for (const result of results) {
        const matchingIndex = findMatchingImageIndex(result.path);

        if (matchingIndex !== -1) {
          try {
            const satelliteKey = `satellite-${matchingIndex}`;
            const maskKey = `mask-${matchingIndex}`;

            if (!loadedImages[satelliteKey]) {
              const satelliteFile = await images[matchingIndex].image.getFile();
              newLoadedImages[satelliteKey] = URL.createObjectURL(satelliteFile);
            }

            if (!loadedImages[maskKey]) {
              const maskFile = await images[matchingIndex].annotation.getFile();
              newLoadedImages[maskKey] = URL.createObjectURL(maskFile);
            }
          } catch (error) {
            console.error(`Error loading images for index ${matchingIndex}:`, error);
          }
        }
      }

      // Merge safely with previous state
      setLoadedImages(prev => ({ ...prev, ...newLoadedImages }));
    };

    if (results.length > 0 && images.length > 0) {
      loadResultImages();
    }

    // No cleanup here anymore — handled separately on unmount
  }, [results, images]);

  // Cleanup blob URLs on unmount only
  useEffect(() => {
    return () => {
      Object.values(loadedImages).forEach(url => {
        URL.revokeObjectURL(url);
      });
    };
  }, []);

  const findMatchingImageIndex = (imageName) => {
    const baseName = imageName.split('.')[0];
    for (let i = 0; i < images.length; i++) {
      const filePair = images[i];
      if (filePair?.image) {
        if (filePair.image.name === imageName || filePair.image.name.split('.')[0] === baseName) {
          return i;
        }
      }
    }
    return -1;
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
            <div key={index} className="result-item" onClick={() => handleResultClick(matchingIndex)}>
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
