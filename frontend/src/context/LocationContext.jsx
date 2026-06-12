import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const LocationContext = createContext();

export function LocationProvider({ children }) {
  // Default to Bhopal or allow it to be empty/national
  const [district, setDistrict] = useState('Bhopal');
  const [availableDistricts, setAvailableDistricts] = useState([]);
  
  useEffect(() => {
    // Fetch unique districts from reports_data or just disease_profiles
    const fetchDistricts = async () => {
      try {
        const { data, error } = await supabase
          .from('reports_data')
          .select('district')
          .limit(1000);
          
        if (error) throw error;
        
        // Extract unique
        const unique = [...new Set(data.map(r => r.district))].filter(Boolean).sort();
        if (unique.length > 0) {
            setAvailableDistricts(unique);
            // Optionally set default to the first one if Bhopal isn't there
            if (!unique.includes('Bhopal')) {
                setDistrict(unique[0]);
            }
        } else {
            // Fallback list
            setAvailableDistricts(['Bhopal', 'Delhi', 'Mumbai', 'Chennai', 'Kolkata']);
        }
      } catch (err) {
        console.error("Error fetching districts:", err);
        setAvailableDistricts(['Bhopal', 'Delhi', 'Mumbai', 'Chennai', 'Kolkata']);
      }
    };
    fetchDistricts();
  }, []);

  return (
    <LocationContext.Provider value={{ district, setDistrict, availableDistricts }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  return useContext(LocationContext);
}
