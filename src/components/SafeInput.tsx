import React, { useState, useEffect } from 'react';

export const SafeInput = ({ value, onChange, type = "text", className, placeholder, ...props }: any) => {
  const [localVal, setLocalVal] = useState(value);
  
  useEffect(() => { 
    setLocalVal(value); 
  }, [value]);
  
  const handleBlur = () => { 
    if (localVal !== value) onChange(localVal); 
  };
  
  const handleKeyDown = (e: any) => { 
    if (e.key === 'Enter') handleBlur(); 
  };
  
  return (
    <input 
      type={type} 
      value={localVal || ''} 
      onChange={(e) => setLocalVal(e.target.value)} 
      onBlur={handleBlur} 
      onKeyDown={handleKeyDown} 
      className={className} 
      placeholder={placeholder} 
      {...props} 
    />
  );
};
