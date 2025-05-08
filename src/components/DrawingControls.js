import { useState } from 'react';
import { Square, Circle, Save, Trash, Eraser } from 'lucide-react';
import '../styles/drawingcontrols.css';

const DrawingControls = ({ onToolChange, onColorChange, onSave, onClear }) => {
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
    { label: 'Sidewalk', color: 'blue' },
    { label: 'Crosswalk', color: 'red' },
    { label: 'Background', color: 'black' },
    { label: 'Footpath', color: 'cyan' }
  ];

  return (
    <div className="drawing-controls">
      <h3>Drawing Tools</h3>
      
      {/* Drawing Tools */}
      <div className="tool-buttons">
        <button 
          className={`tool-button ${activeTool === 'rectangle' ? 'active' : ''}`}
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
          className={`tool-button ${activeTool === 'eraser' ? 'active' : ''}`}
          onClick={() => handleToolSelect('eraser')}
          title="Eraser Tool"
        >
          <Eraser size={20} />
        </button>
      </div>
      
      {/* Color Selection */}
      <div className="color-selection">
        <h4>Labels</h4>
        <div className="color-options">
          {colorOptions.map((option) => (
            <button
              key={option.label}
              className={`color-option ${activeColor === option.color ? 'active' : ''}`}
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
          className="save-button"
          onClick={onSave}
        >
          <Save size={16} />
          <span>Save Mask</span>
        </button>
        <button 
          className="clear-button"
          onClick={onClear}
        >
          <Trash size={16} />
          <span>Clear</span>
        </button>
      </div>
    </div>
  );
};

export default DrawingControls;