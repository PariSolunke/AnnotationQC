
import React, { useState, useMemo } from 'react';
import '../styles/imagenavigationbar.css';

const ImageNavigationBar = ({ 
  images, 
  currentIndex, 
  csvData, 
  onNavigate,
  onPrevious,
  onNext
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Get current image info
  const currentImage = images[currentIndex];
  const currentImageName = currentImage?.image?.name || 'No image loaded';
  
  // Get current status from CSV
  const currentStatus = useMemo(() => {
    if (!csvData || !currentImage) return null;
    const entry = csvData.find(row => row.Image === currentImage.image.name);
    return entry?.Status || null;
  }, [csvData, currentImage]);

  // Filter images based on search term
  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return [];
    
    const term = searchTerm.toLowerCase();
    return images
      .map((img, index) => ({
        name: img.image.name,
        index: index,
        status: csvData?.find(row => row.Image === img.image.name)?.Status || null
      }))
      .filter(img => img.name.toLowerCase().includes(term))
      .slice(0, 20); // Limit to 20 results
  }, [searchTerm, images, csvData]);

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setShowSearchResults(true);
  };

  const handleResultClick = (index) => {
    onNavigate(index);
    setSearchTerm('');
    setShowSearchResults(false);
  };

  const handleSearchBlur = () => {
    // Delay to allow click on search results
    setTimeout(() => setShowSearchResults(false), 200);
  };

  const getStatusBadge = (status) => {
    if (!status) return null;
    
    const className = status === 'good' ? 'status-badge good' : 'status-badge bad';
    const label = status === 'good' ? '✓ Match' : '✗ Mismatch';
    
    return <span className={className}>{label}</span>;
  };

  return (
    <div className="image-navigation-bar">
      <div className="navigation-top">
        <div className="image-info">
          <span className="image-label">Current Image:</span>
          <span className="image-name" title={currentImageName}>
            {currentImageName}
          </span>
        </div>
        
        <div className="image-counter">
          {currentIndex + 1} / {images.length}
        </div>
      </div>

      <div className="navigation-controls">
        <button 
          onClick={onPrevious} 
          disabled={currentIndex === 0}
          className="nav-button"
        >
          ← Previous
        </button>

        <div className="search-container">
          <input
            type="text"
            placeholder="Search images by name..."
            value={searchTerm}
            onChange={handleSearchChange}
            onFocus={() => searchTerm && setShowSearchResults(true)}
            onBlur={handleSearchBlur}
            className="search-input"
          />
          
          {showSearchResults && searchResults.length > 0 && (
            <div className="search-dropdown">
              {searchResults.map((result) => (
                <div
                  key={result.index}
                  className="search-result-item"
                  onMouseDown={() => handleResultClick(result.index)}
                >
                  <span className="result-name">{result.name}</span>
                  {result.status && getStatusBadge(result.status)}
                </div>
              ))}
            </div>
          )}
          
          {showSearchResults && searchTerm && searchResults.length === 0 && (
            <div className="search-dropdown">
              <div className="search-result-item no-results">
                No images found
              </div>
            </div>
          )}
        </div>

        <button 
          onClick={onNext} 
          disabled={currentIndex === images.length - 1}
          className="nav-button"
        >
          Next →
        </button>
        {currentStatus && getStatusBadge(currentStatus)}

      </div>
    </div>
  );
};

export default ImageNavigationBar;