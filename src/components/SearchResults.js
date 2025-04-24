// components/SearchResults.js
import React from 'react';
import "../styles/searchresults.css"

function SearchResults({ results, status }) {

  return (
    
    <>
        <div className="search-status">{status}</div>

        <div className="search-results">
            {results.map((result, index) => (
                <div key={index} className="result-item">
                    <img src={result.image_data} alt={`Result ${index}`} />
                    <p>Similarity: {result.similarity.toFixed(2)}</p>
                </div>
            ))}
        </div>
    
    </>
  );
}

export default SearchResults;