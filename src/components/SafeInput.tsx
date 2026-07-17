import React, { useState, useEffect } from 'react';

export const SafeInput = ({ value, onChange, type = "text", className, placeholder, ...props }: any) => {
  const [localVal, setLocalVal] = useState(value);
  
  useEffect(() => { 
    setLocalVal(value); 
  }, [value]);
  
  const handleBlur = () => { 
    if (localVal !== value) onChange({ target: { value: localVal } }); 
  };
  
  const handleKeyDown = (e: any) => { 
    if (e.key === 'Enter') handleBlur(); 
  };
  
  return (
    <input 
      type={type} 
      value={localVal || ''} 
      onChange={(e) => setLocalVal(e.target.value)} 
      onBlur={(e) => {
        handleBlur();
        if (props.onBlur) props.onBlur(e);
      }} 
      onKeyDown={(e) => {
        handleKeyDown(e);
        if (props.onKeyDown) props.onKeyDown(e);
      }} 
      className={className} 
      placeholder={placeholder} 
      {...Object.keys(props).reduce((acc, key) => {
        if (key !== 'onBlur' && key !== 'onKeyDown') acc[key] = props[key];
        return acc;
      }, {})} 
    />
  );
};
