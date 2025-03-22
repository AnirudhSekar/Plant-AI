import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';
import { PLANT_ID_API_KEY, PLANT_ID_API_URL, GOOGLE_API_KEY } from '@env';

if (!GOOGLE_API_KEY) throw new Error('GOOGLE_API_KEY is not defined');
if (!PLANT_ID_API_URL) throw new Error('PLANT_ID_API_URL is not defined');
if (!PLANT_ID_API_KEY) throw new Error('PLANT_ID_API_KEY is not defined');

// ...rest of your existing code...

const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);

async function generateCareInstructions(plantName: string, scientificName: string): Promise<{
  water: string;
  light: string;
  humidity: string;
  temperature: string;
  wateringFrequencyHours: number;
}> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `
      As a plant expert, provide care instructions for ${plantName} (${scientificName}).
      Focus on accurate watering frequency. Return a concise JSON:
      {
        "water": "1-2 sentence watering guide",
        "light": "light needs in 5-10 words",
        "humidity": "humidity as percentage",
        "temperature": "temp range in °F",
        "wateringFrequencyHours": exact hours between watering (24=daily, 48=2 days, 72=3 days, 168=weekly)
      }
      Note: Be specific about watering frequency based on the plant's actual needs.
    `;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }]}],
      generationConfig: {
        temperature: 0.2, // Even lower temperature for more precise outputs
        maxOutputTokens: 150,
      }
    });

    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const careInstructions = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    
    // Validate watering frequency
    const wateringHours = parseInt(careInstructions.wateringFrequencyHours?.toString());
    const validWateringHours = wateringHours >= 24 && wateringHours <= 336 
      ? wateringHours 
      : getDefaultWateringFrequency(plantName);
    
    return {
      water: careInstructions.water || 'Water when top inch of soil is dry',
      light: careInstructions.light || 'Medium to bright indirect light',
      humidity: careInstructions.humidity || '50%',
      temperature: careInstructions.temperature || '65-80°F',
      wateringFrequencyHours: validWateringHours
    };
  } catch (error) {
    console.error('Error generating care instructions:', error);
    return getDefaultCareInstructions();
  }
}

// Add this helper function for default watering frequency
function getDefaultWateringFrequency(plantName: string): number {
  const lowWaterPlants = ['cactus', 'succulent', 'zz plant', 'snake plant'];
  const highWaterPlants = ['fern', 'calathea', 'peace lily'];
  
  const plantNameLower = plantName.toLowerCase();
  
  if (lowWaterPlants.some(p => plantNameLower.includes(p))) {
    return 168; // Weekly
  } else if (highWaterPlants.some(p => plantNameLower.includes(p))) {
    return 48; // Every 2 days
  }
  return 72; // Default to every 3 days
}

// ... rest of your existing code remains the same ...
export const identifyPlant = async (base64Image: string) => {
  try {
    // First use Plant.id to identify the plant
    const identifyResponse = await axios.post(PLANT_ID_API_URL, {
      api_key: PLANT_ID_API_KEY,
      images: [base64Image],
    });

    if (!identifyResponse.data?.result) {
      throw new Error('Invalid response from plant identification service');
    }

    const suggestions = identifyResponse.data.result.classification?.suggestions;
    if (!suggestions || suggestions.length === 0) {
      throw new Error('No plant matches found');
    }

    const result = suggestions[0];

    // Get care instructions from OpenAI
    const careInstructions = await generateCareInstructions(
      result.name,
      result.scientific_name || result.name
    );

    return {
      name: result.name,
      scientificName: result.scientific_name || result.name,
      confidence: result.probability,
      careInstructions
    };

  } catch (error) {
    console.error('Error:', error);
    throw new Error(
      error instanceof Error 
        ? error.message 
        : 'Failed to process plant. Please try again with a clearer photo.'
    );
  }
};

const getDefaultCareInstructions = () => ({
  water: 'Water when top inch of soil is dry',
  light: 'Bright indirect light',
  humidity: 'Average home humidity (40-60%)',
  temperature: '65-80°F (18-27°C)',
  wateringFrequencyHours: 72 // Default to every 3 days
});