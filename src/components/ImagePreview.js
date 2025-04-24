// components/ImagePreview.js
import React, { useState, useEffect } from 'react';
import "../styles/imagepreview.css"

function ImagePreview({ images, currentIndex, onPreviewClick }) {
  const [previewURLs, setPreviewURLs] = useState([]);
  
  // Calculate which images to show in the preview (current + next 3)
  useEffect(() => {
    const loadPreviews = async () => {
      const previewsToLoad = [];
      const startIndex = Math.max(0, currentIndex);
      const endIndex = Math.min(images.length, startIndex + 4);
      
      for (let i = startIndex; i < endIndex; i++) {
        try {
          const imageFile = await images[i].image.getFile();
          previewsToLoad.push({
            index: i,
            url: URL.createObjectURL(imageFile)
          });
        } catch (error) {
          console.error(`Error loading preview for image ${i}:`, error);
        }
      }
      
      setPreviewURLs(previewsToLoad);
    };
    
    if (images.length > 0) {
      loadPreviews();
    }
    
    // Cleanup function to revoke object URLs
    return () => {
      previewURLs.forEach(preview => URL.revokeObjectURL(preview.url));
    };
  }, [images, currentIndex]);

  return (
    <div className="preview-sidebar">
      <h3>Image Previews</h3>
      <div className="preview-list">
        {previewURLs.map((preview) => (
          <div 
            key={preview.index}
            className={`preview-item ${preview.index === currentIndex ? 'active' : ''}`}
            onClick={() => onPreviewClick(preview.index)}
          >
            <img 
              src={preview.url} 
              alt={`Preview ${preview.index + 1}`} 
            />
            <div className="preview-index">{preview.index + 1}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ImagePreview;