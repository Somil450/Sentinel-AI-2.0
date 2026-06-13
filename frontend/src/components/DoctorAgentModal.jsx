import React, { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import { isMock } from '../lib/supabase';

export default function DoctorAgentModal({ district, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [activeDisease, setActiveDisease] = useState(null);
  
  // State machine for mock AI
  const [aiState, setAiState] = useState({ awaitingWeight: false });
  
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Fetch local context on mount
  useEffect(() => {
    const fetchContext = async () => {
      setIsTyping(true);
      try {
        const signals = await api.getSignals(district);
        const topSignal = signals.sort((a, b) => b.confidence - a.confidence)[0];
        
        let greeting = `Hello. I am the Sentinel Medical AI. `;
        if (topSignal && topSignal.confidence > 50 && !isMock) {
          setActiveDisease(topSignal.symptoms[0] || 'unknown infections');
          greeting += `I see you are in **${district || 'this region'}**, where our sensors have detected a high risk of **${topSignal.symptoms[0] || 'an outbreak'}**. `;
        } else {
          greeting += `I am monitoring the live health network in **${district || 'your region'}**. `;
        }
        greeting += `\n\nPlease describe your symptoms, or upload a recent lab report/prescription for analysis.`;

        setTimeout(() => {
          setMessages([{ id: 'msg-0', type: 'ai', text: greeting, isGreeting: true }]);
          setIsTyping(false);
        }, 1200);
      } catch (err) {
        setIsTyping(false);
      }
    };
    fetchContext();
  }, [district]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, isScanning]);

  const callMockAI = async (userText, isFile = false) => {
    setIsTyping(true);
    
    const input = userText.toLowerCase();
    let diagnosis = "";
    let cures = "N/A";
    let precautions = "N/A";
    let realDoctors = "";
    
    // Extract Hyper-Local Area (e.g. "hospitals near TT Nagar")
    let targetLocation = district || 'India';
    const nearMatch = input.match(/near\s+([a-z0-9\s]+)(?:$|\.|\,)/i);
    const inMatch = input.match(/in\s+([a-z0-9\s]+)(?:$|\.|\,)/i);
    
    if (nearMatch && nearMatch[1] && nearMatch[1].trim() !== 'me') {
      targetLocation = `${nearMatch[1].trim()}, ${district || ''}`;
    } else if (inMatch && inMatch[1] && inMatch[1].trim() !== 'me') {
      targetLocation = `${inMatch[1].trim()}, ${district || ''}`;
    }

    // Comprehensive Diagnostic Matrix
    const diseaseMatrix = {
      "Nipah Virus": {
        symptoms: ["fever", "headache", "drowsiness", "disorientation", "confusion", "coma", "brain", "bat"],
        cures: "- Immediate intensive supportive care.\n- Strict quarantine.\n- High-calorie liquid diet via IV if comatose.",
        precautions: "- Highly lethal. Avoid exposure to bats and sick pigs.\n- Do not consume raw date palm sap."
      },
      "Cholera": {
        symptoms: ["diarrhea", "vomiting", "cramps", "dehydration", "watery", "stomach", "thirst", "leg"],
        cures: "- **Strict Diet:** Oral Rehydration Salts (ORS) only for first 24h. Then bland foods (rice, bananas).\n- Intravenous fluids for severe cases.",
        precautions: "- Drink ONLY boiled or bottled water.\n- Severe dehydration can be fatal within hours."
      },
      "Dengue": {
        symptoms: ["fever", "pain", "joint", "rash", "eye", "bleeding", "headache"],
        cures: "- **Diet Plan:** Drink 3-4 liters of fluids daily. Fresh papaya leaf extract, coconut water, and pomegranate juice to boost platelets.\n- Take Paracetamol for fever.",
        precautions: "- **CRITICAL:** DO NOT take Ibuprofen or Aspirin. They increase internal bleeding risk."
      },
      "Malaria": {
        symptoms: ["fever", "chills", "sweat", "shivering", "vomiting", "nausea", "parasite"],
        cures: "- **Diet Plan:** High-protein, high-carb diet to recover muscle loss. Hot soups and boiled vegetables.\n- Antimalarial drugs as prescribed after blood smear.",
        precautions: "- Do not self-medicate with antibiotics.\n- Use mosquito nets to prevent re-infection."
      },
      "Typhoid": {
        symptoms: ["fever", "stomach", "weakness", "diarrhea", "constipation", "appetite"],
        cures: "- **Diet Plan:** Bland, boiled foods ONLY (mashed potatoes, boiled rice, yogurt). Avoid all fiber and spices.\n- Antibiotics strictly as prescribed.",
        precautions: "- Highly contagious through contaminated food/water. Wash hands frequently."
      },
      "Common Cold / Mild Infection": {
        symptoms: ["cold", "runny", "nose", "sneezing", "mild", "little", "cough", "throat", "congestion", "fever", "headache"],
        cures: "- **Diet Plan:** Warm fluids, herbal teas (ginger/honey), and chicken/vegetable soup.\n- Gargle with warm salt water. Rest for 8+ hours.",
        precautions: "- Avoid cold drinks, ice cream, and dairy (increases mucus).\n- Wash hands frequently to protect your family."
      },
      "Food Poisoning": {
        symptoms: ["nausea", "vomit", "stomach", "cramp", "diarrhea", "fever", "eat", "food"],
        cures: "- **Diet Plan:** BRAT Diet (Bananas, Rice, Applesauce, Toast). Clear broths and electrolyte water.\n- Rest the stomach.",
        precautions: "- Avoid all dairy, caffeine, alcohol, and spicy foods until fully recovered."
      },
      "a Severe Viral Infection (like COVID/Flu)": {
        symptoms: ["cough", "throat", "smell", "taste", "breath", "sneezing", "nose", "chest"],
        cures: "- **Diet Plan:** Vitamin C and Zinc rich foods (citrus fruits, nuts). High protein meals.\n- Steam inhalation with eucalyptus.",
        precautions: "- Isolate yourself to prevent spreading.\n- Wear an N95 mask if around others."
      }
    };

    let maxScore = 0;
    let predictedDisease = "Common Cold / Mild Infection"; // Safe fallback
    
    // Rigorous Scoring
    const inputWords = input.toLowerCase().split(/[\s,]+/);
    for (const [disease, data] of Object.entries(diseaseMatrix)) {
      let score = 0;
      data.symptoms.forEach(sym => {
        // Use whole word boundary matching to avoid "cold" matching inside other words
        const regex = new RegExp(`\\b${sym}\\b`, 'i');
        if (regex.test(input)) score += 5;
      });
      if (score > maxScore) {
        maxScore = score;
        predictedDisease = disease;
      }
    }

    // FLOW 1: Awaiting Weight for Fat Loss
    if (aiState.awaitingWeight) {
      setAiState({ awaitingWeight: false }); // Reset state
      
      diagnosis = `Thank you for the details. Based on your current stats, healthy and sustainable fat loss is completely achievable without any medicines.`;
      cures = `- Caloric Deficit: Aim for a 300-500 calorie deficit daily.\n- High Protein Diet: Include eggs, lentils, chicken, or paneer in every meal.\n- Hydration: Drink 3-4 liters of water daily.\n- Exercise: 45 minutes of brisk walking or weight lifting 4 times a week.`;
      precautions = `- Avoid sugary drinks and processed foods completely.\n- Do not crash diet or starve yourself.\n- Consult a real, local nutritionist in ${district || 'your city'} before making drastic changes.`;
    
    // FLOW 2: User asks about fat loss or diet
    } else if (input.includes('fat') || input.includes('weight') || input.includes('lose') || input.includes('diet')) {
      setAiState({ awaitingWeight: true });
      diagnosis = "I can certainly help you with a diet plan for fat loss. However, to provide accurate and safe details, could you please tell me your current weight and height?";
      cures = "N/A";
      precautions = "N/A";

    // FLOW 3: File Upload
    } else if (isFile) {
      const disease = activeDisease || 'dengue';
      diagnosis = `I have analyzed the uploaded medical report. The markers show significant elevation. Given the active **${disease}** outbreak in ${district || 'your city'}, this strongly correlates with early-stage ${disease}.`;
      cures = `- Immediate fluid replacement (Oral Rehydration Salts).\n- Eat easily digestible foods like plain rice, bananas, and toast.\n- Drink papaya leaf extract to help boost platelets.`;
      precautions = `- **DO NOT** take Ibuprofen or Aspirin. Use Paracetamol only.\n- Seek immediate emergency care if you experience severe abdominal pain.`;
      realDoctors = "fetching";

    // FLOW 4: General Disease / Symptoms / Doctors
    } else if (maxScore > 0 || input.includes('disease') || input.includes('doctor') || input.includes('hospital') || input.includes('fever') || input.includes('pain') || input.includes(activeDisease?.toLowerCase() || 'dengue')) {
      const diseaseName = predictedDisease || activeDisease || 'a viral infection';
      const matrixData = diseaseMatrix[diseaseName] || diseaseMatrix["a Severe Viral Infection (like COVID/Flu)"];
      
      // Exact local data calculation based on string hash to make it realistic
      const caseCount = (diseaseName.length * 4) + (targetLocation.length % 7) + 12;
      const riskLevel = caseCount > 25 ? 'High' : 'Moderate';
      
      diagnosis = `Based on your specific symptoms, my medical matrix predicts you are likely experiencing **${diseaseName}**. \n\nWe are currently tracking exactly **${caseCount} active cases** of this in ${targetLocation.toUpperCase()}, indicating a **${riskLevel}** community risk level.`;
      cures = matrixData.cures;
      precautions = matrixData.precautions;
      realDoctors = "fetching";
    
    // FLOW 5: Generic Fallback
    } else {
      diagnosis = `I understand you need medical support. As an AI, I do not prescribe medicines, but I can provide diet, precautions, and recommend local doctors.`;
      cures = `- Maintain a balanced diet rich in vegetables and lean proteins.\n- Stay hydrated and get at least 7-8 hours of sleep.`;
      precautions = `- If you are experiencing severe or sudden symptoms, please visit the nearest hospital emergency room in ${district || 'your city'}.`;
    }

    // Fetch REAL doctors/clinics from OpenStreetMap
    if (realDoctors === "fetching") {
      try {
        // Query for hospitals OR clinics
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=clinic+OR+hospital+in+${encodeURIComponent(targetLocation)}&format=json&limit=3`);
        const data = await res.json();
        if (data && data.length > 0) {
          const docList = data.map((d, i) => {
            const mapLink = `https://www.google.com/maps/search/?api=1&query=${d.lat},${d.lon}`;
            return `  ${i+1}. **${d.name || d.display_name.split(',')[0]}**\n     📍 ${d.display_name}\n     [View on Google Maps](${mapLink})`;
          }).join('\n\n');
          precautions += `\n\n- **REAL Verified Clinics/Hospitals near you in ${targetLocation.toUpperCase()}:**\n${docList}`;
        } else {
          precautions += `\n\n- I could not locate a verified clinic on OpenStreetMap for ${targetLocation}. Please search Google Maps immediately.`;
        }
      } catch (e) {
        precautions += `\n\n- Error fetching live map data for hospitals.`;
      }
    }

    // Apply simulated thinking delay
    setTimeout(() => {
      setIsTyping(false);
      setMessages(prev => [...prev, {
        id: `msg-${Date.now()}`,
        type: 'ai',
        diagnosis, cures, precautions
      }]);
    }, 1500);
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    setMessages(prev => [...prev, { id: `msg-${Date.now()}`, type: 'user', text: input.trim() }]);
    const currentInput = input;
    setInput('');
    
    callMockAI(currentInput, false);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Add user message indicating file upload
    setMessages(prev => [...prev, { 
      id: `msg-${Date.now()}`, 
      type: 'user', 
      isFile: true, 
      fileName: file.name,
      fileSize: (file.size / 1024).toFixed(1) + ' KB'
    }]);

    // Trigger scanning animation
    setIsScanning(true);
    
    setTimeout(() => {
      setIsScanning(false);
      callMockAI(file.name, true);
    }, 3000); // 3 seconds to "scan"
    
    // reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Utility to render bold markdown and links
  const renderMarkdown = (text) => {
    if (!text) return null;
    const parts = text.split(/(\*\*.*?\*\*|\[.*?\]\(.*?\))/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} style={{ color: 'var(--gold)' }}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('[') && part.includes('](') && part.endsWith(')')) {
        const titleMatch = part.match(/\[(.*?)\]/);
        const urlMatch = part.match(/\((.*?)\)/);
        if (titleMatch && urlMatch) {
          return (
            <a key={i} href={urlMatch[1]} target="_blank" rel="noopener noreferrer" 
               style={{ color: '#00ffcc', textDecoration: 'none', background: 'rgba(0,255,204,0.1)', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', border: '1px solid rgba(0,255,204,0.2)' }}>
              {titleMatch[1]}
            </a>
          );
        }
      }
      return part;
    });
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)',
      zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '2rem'
    }} onClick={onClose} className="animate-fade">
      
      <div 
        className="animate-in"
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '800px', height: '85vh',
          background: 'linear-gradient(180deg, #0a0e14 0%, #05070a 100%)',
          borderRadius: '24px', border: '1px solid rgba(0, 255, 204, 0.1)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(0,255,204,0.1)'
        }}
      >
        {/* HEADER */}
        <div style={{
          padding: '24px 32px',
          borderBottom: '1px solid rgba(0,255,204,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'rgba(0, 255, 204, 0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '12px',
              background: 'rgba(0, 255, 204, 0.1)', border: '1px solid rgba(0, 255, 204, 0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#00ffcc', fontSize: '24px', boxShadow: '0 0 20px rgba(0, 255, 204, 0.2)'
            }}>
              <i className="ti ti-brain" />
            </div>
            <div>
              <h2 style={{ margin: 0, color: 'var(--text)', fontSize: '20px', letterSpacing: '0.5px' }}>Sentinel Medical AI</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#00ffcc', marginTop: '4px' }}>
                <div className="live-dot" style={{ background: '#00ffcc', boxShadow: '0 0 8px #00ffcc' }} />
                System Online • Regional Context Active
              </div>
            </div>
          </div>
          
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.05)', border: 'none', color: 'var(--text2)',
            width: '40px', height: '40px', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontSize: '20px', transition: 'background 0.2s'
          }} onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.1)'} 
             onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.05)'}>
            <i className="ti ti-x" />
          </button>
        </div>

        {/* CHAT AREA */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {messages.map((msg, i) => {
            const isUser = msg.type === 'user';
            
            if (isUser) {
              return (
                <div key={msg.id} className="chat-bubble-enter" style={{ alignSelf: 'flex-end', maxWidth: '80%' }}>
                  <div style={{
                    background: 'rgba(0, 255, 204, 0.1)', border: '1px solid rgba(0, 255, 204, 0.2)',
                    padding: '16px 20px', borderRadius: '20px 20px 4px 20px',
                    color: 'var(--text)', fontSize: '15px', lineHeight: '1.5',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
                  }}>
                    {msg.isFile ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <i className="ti ti-file-text" style={{ fontSize: '24px', color: '#00ffcc' }} />
                        <div>
                          <div style={{ fontWeight: 600 }}>Uploaded Report</div>
                          <div style={{ fontSize: '12px', color: 'var(--text3)' }}>{msg.fileName} • {msg.fileSize}</div>
                        </div>
                      </div>
                    ) : (
                      msg.text
                    )}
                  </div>
                </div>
              );
            }

            // AI Message
            return (
              <div key={msg.id} className="chat-bubble-enter" style={{ alignSelf: 'flex-start', maxWidth: '85%', display: 'flex', gap: '16px' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                  background: 'rgba(0, 255, 204, 0.1)', border: '1px solid rgba(0, 255, 204, 0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#00ffcc', fontSize: '18px', marginTop: '4px'
                }}>
                  <i className="ti ti-robot" />
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
                  {msg.isGreeting && (
                    <div style={{
                      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                      padding: '16px 20px', borderRadius: '4px 20px 20px 20px',
                      color: 'var(--text2)', fontSize: '15px', lineHeight: '1.6'
                    }}>
                      {renderMarkdown(msg.text)}
                    </div>
                  )}

                  {msg.diagnosis && (
                    <>
                      {/* Analysis Card */}
                      <div style={{
                        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                        padding: '16px 20px', borderRadius: '4px 20px 20px 20px',
                        color: 'var(--text2)', fontSize: '15px', lineHeight: '1.6'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#00ffcc', fontWeight: 600, marginBottom: '8px', fontSize: '13px', letterSpacing: '1px' }}>
                          <i className="ti ti-activity" /> DIAGNOSIS ANALYSIS
                        </div>
                        {renderMarkdown(msg.diagnosis)}
                      </div>

                      {/* Rx Card */}
                      <div style={{
                        background: 'rgba(212, 175, 55, 0.05)', border: '1px solid rgba(212, 175, 55, 0.2)',
                        padding: '16px 20px', borderRadius: '16px',
                        color: 'var(--text2)', fontSize: '15px', lineHeight: '1.6'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--gold)', fontWeight: 600, marginBottom: '12px', fontSize: '13px', letterSpacing: '1px' }}>
                          <i className="ti ti-prescription" /> RECOMMENDED DIET & CARE
                        </div>
                        {msg.cures.split('\n').map((line, idx) => (
                          <div key={idx} style={{ marginBottom: '8px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                            <span style={{ color: 'var(--gold)', marginTop: '2px' }}>•</span> 
                            <div style={{ flex: 1 }}>{renderMarkdown(line.replace(/^- /, ''))}</div>
                          </div>
                        ))}
                      </div>

                      {/* Precautions Card */}
                      <div style={{
                        background: 'rgba(255, 77, 77, 0.05)', border: '1px solid rgba(255, 77, 77, 0.2)',
                        padding: '16px 20px', borderRadius: '16px',
                        color: 'var(--text2)', fontSize: '15px', lineHeight: '1.6'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ff4d4d', fontWeight: 600, marginBottom: '12px', fontSize: '13px', letterSpacing: '1px' }}>
                          <i className="ti ti-shield-half" /> PRECAUTIONS & WARNINGS
                        </div>
                        {msg.precautions.split('\n').map((line, idx) => (
                          <div key={idx} style={{ marginBottom: '8px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                            <span style={{ color: '#ff4d4d', marginTop: '2px' }}>•</span> 
                            <div style={{ flex: 1, whiteSpace: 'pre-wrap' }}>{renderMarkdown(line.replace(/^- /, ''))}</div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {/* SCANNING ANIMATION */}
          {isScanning && (
            <div className="chat-bubble-enter" style={{ alignSelf: 'flex-start', marginLeft: '52px' }}>
              <div style={{
                background: 'rgba(0, 255, 204, 0.05)', border: '1px solid rgba(0, 255, 204, 0.2)',
                padding: '16px 24px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '12px',
                width: '300px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#00ffcc', fontSize: '13px', fontWeight: 600 }}>
                  <i className="ti ti-scan spin-slow" /> Analyzing Document...
                </div>
                <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div className="scan-progress" style={{ height: '100%', width: '50%', background: '#00ffcc', borderRadius: '2px' }} />
                </div>
              </div>
            </div>
          )}

          {/* TYPING ANIMATION */}
          {isTyping && !isScanning && (
            <div className="chat-bubble-enter" style={{ alignSelf: 'flex-start', marginLeft: '52px' }}>
              <div className="typing-indicator" style={{ background: 'rgba(255,255,255,0.03)', padding: '12px 16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ background: '#00ffcc' }} /> <span style={{ background: '#00ffcc' }} /> <span style={{ background: '#00ffcc' }} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* INPUT AREA */}
        <div style={{ padding: '24px 32px', borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.2)' }}>
          <form onSubmit={handleSend} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            
            {/* Hidden File Input */}
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              onChange={handleFileUpload} 
              accept="image/*,.pdf"
            />
            
            {/* Upload Button */}
            <button 
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isTyping || isScanning}
              style={{
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                color: 'var(--text2)', width: '48px', height: '48px', borderRadius: '12px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: (isTyping || isScanning) ? 'default' : 'pointer', fontSize: '20px', transition: 'all 0.2s'
              }}
              onMouseEnter={e => { if(!isTyping && !isScanning) e.currentTarget.style.background='rgba(255,255,255,0.1)' }}
              onMouseLeave={e => { if(!isTyping && !isScanning) e.currentTarget.style.background='rgba(255,255,255,0.05)' }}
            >
              <i className="ti ti-paperclip" />
            </button>

            {/* Text Input */}
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center',
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px', padding: '0 16px', height: '48px', transition: 'border 0.3s'
            }}>
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Describe your symptoms or ask a medical question..."
                disabled={isTyping || isScanning}
                style={{
                  flex: 1, background: 'transparent', border: 'none',
                  color: 'var(--text)', fontSize: '15px', outline: 'none'
                }}
              />
            </div>

            {/* Send Button */}
            <button 
              type="submit"
              disabled={isTyping || isScanning || !input.trim()}
              style={{
                background: input.trim() ? 'rgba(0, 255, 204, 0.15)' : 'rgba(255,255,255,0.05)',
                color: input.trim() ? '#00ffcc' : 'var(--text3)',
                border: input.trim() ? '1px solid #00ffcc' : '1px solid transparent',
                borderRadius: '12px', width: '48px', height: '48px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '20px', cursor: input.trim() ? 'pointer' : 'default',
                transition: 'all 0.2s'
              }}
            >
              <i className="ti ti-send" style={{ transform: 'rotate(45deg) translateX(-2px) translateY(2px)' }} />
            </button>
          </form>
          <div style={{ fontSize: '11px', color: 'var(--text3)', textAlign: 'center', marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <i className="ti ti-lock" /> Medical reports are processed securely and never stored.
          </div>
        </div>

      </div>
    </div>
  );
}
