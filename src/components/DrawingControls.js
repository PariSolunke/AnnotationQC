import { useState } from 'react';
import { Square, Circle, Save, Trash, Hexagon } from 'lucide-react';
import '../styles/drawingcontrols.css';

const DrawingControls = ({ interactionMode, onToolChange, onColorChange, onSave, onClear, onAutoBridge, onShift }) => {
  const [activeTool, setActiveTool] = useState(null);
  const [activeColor, setActiveColor] = useState('blue');

  const handleToolSelect = (tool) => {
    if (activeTool === tool) {
      setActiveTool(null);
      onToolChange(null);
      return;
    }
    setActiveTool(tool);
    onToolChange(tool);
  };

  const handleColorSelect = (color, label) => {
    setActiveColor(color);
    onColorChange(color, label);
  };

  const colorOptions = [
    { label: 'Sidewalk', color: 'rgb(0, 0, 255)' },
    { label: 'Crosswalk', color: 'rgb(255, 0, 0)' },
    { label: 'Background', color: 'rgb(0, 0, 0)' },
    { label: 'Road', color: 'rgb(0, 128, 0)' } 
  ];

  const handleShift = (direction) => {
    if (onShift) {
      onShift(direction);
    }
  };

  return (
    <div className="drawing-controls">
      <h3>Drawing Tools</h3>
      
      {/* Drawing Tools */}
      <div className="tool-buttons">
        <button 
          className={`tool-button ${activeTool === 'rectangle'  ? 'active' : ''}`}
          onClick={() => handleToolSelect('rectangle')}
          title="Rectangle Tool"
        >
          <Square size={20} />
        </button>
        <button 
          className={`tool-button ${activeTool === 'brush' ? 'active' : ''}`}
          onClick={() => handleToolSelect('brush')}
          title="Brush Tool"
        >
          <Circle size={20} />
        </button>
        <button 
          className={`tool-button ${activeTool === 'polygon' ? 'active' : ''}`}
          onClick={() => handleToolSelect('polygon')}
          title="Polygon Tool"
        >
          <Hexagon size={20} />
        </button>
      </div>
      
      {/* Color Selection */}
      <div className="color-selection">
        <h4>Labels</h4>
        <div className="color-options">
          {colorOptions.map((option) => (
            <button
              disabled={interactionMode !== 'draw'}
              key={option.label}
              className={`color-option ${activeColor === option.color && interactionMode==='draw'  ? 'active' : ''}`}
              onClick={() => handleColorSelect(option.color, option.label)}
            >
              <div className="color-swatch" style={{ backgroundColor: option.color }}></div>
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      </div>
      
      {/* Action Buttons */}
      <div className="action-buttons">
        <button
          disabled={interactionMode !== 'draw'}
          className="save-button"
          onClick={onSave}
        >
          <Save size={16} />
          <span>Save Mask</span>
        </button>
        <button 
          disabled={interactionMode !== 'draw'}
          className="clear-button"
          onClick={onClear}
        >
          <Trash size={16} />
          <span>Clear</span>
        </button>
      </div>
    
      <button
        disabled={interactionMode !== 'draw'}
        className="auto-bridge-button"
        onClick={onAutoBridge}
      >
        <span> Bridge Cross-Side Gaps </span>
      </button>

      {/* Pixel Shift Controls */}
      <div className="shift-controls">
        <h4>Shift Pixels</h4>
        <div className="shift-buttons">
          <button
            disabled={interactionMode !== 'draw'}
            className="shift-button"
            onClick={() => handleShift('up')}
            title="Shift Up"
          >
            ↑
          </button>
          <button
            disabled={interactionMode !== 'draw'}
            className="shift-button"
            onClick={() => handleShift('left')}
            title="Shift Left"
          >
            ←
          </button>
          <button
            disabled={interactionMode !== 'draw'}
            className="shift-button"
            onClick={() => handleShift('right')}
            title="Shift Right"
          >
            →
          </button>
          <button
            disabled={interactionMode !== 'draw'}
            className="shift-button"
            onClick={() => handleShift('down')}
            title="Shift Down"
          >
            ↓
          </button>
        </div>
      </div>

   
      <button 
        disabled={interactionMode !== 'draw'}
        className="exit-button"
        onClick={() => {
          handleToolSelect(activeTool)
        }}
      >
        <span>Exit Drawing Mode</span>
      </button>
    </div>
  );
};

export default DrawingControls;