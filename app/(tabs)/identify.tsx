import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as tf from '@tensorflow/tfjs';
import * as mobilenet from '@tensorflow-models/mobilenet';
import { router } from 'expo-router';
import { Camera as CameraIcon, Image as ImageIcon } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import React from 'react';

interface CareInstructions {
  water: string;
  light: string;
  humidity: string;
  temperature: string;
  wateringFrequencyHours: number;
}

interface Prediction {
  name: string;
  confidence: number;
  careInstructions: CareInstructions;
}

interface Plant {
  id: string;
  name: string;
  image: string;
  careInstructions: CareInstructions;
  dateAdded: string;
  lastWatered: string;
}

export default function IdentifyScreen() {
  const cameraRef = useRef<CameraView>(null);
  const [facing, setFacing] = useState<CameraType>('back');
  const [model, setModel] = useState<any>(null);
  const [isModelLoading, setIsModelLoading] = useState<boolean>(true);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    setIsModelLoading(false);
  }, []);

  if (!permission) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>No access to camera</Text>
        <Pressable style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </Pressable>
      </View>
    );
  }

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled) {
      await processImage(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    if (!cameraRef.current) return;

    try {
      const photo = await cameraRef.current.takePictureAsync();

      if (photo) {
        setCapturedImage(photo.uri);
        await savePlant(photo.uri);
      }
    } catch (error) {
      console.error('Failed to take photo:', error);
    }
  };

const savePlant = async (uri: string) => {
  try {
    const plant = {
      id: Date.now().toString(),
      name: 'Monstera Deliciosa', // Mock plant name
      image: uri,
      dateAdded: new Date().toISOString(),
      careInstructions: { 
        light: "Bright, indirect sunlight", 
        water: "Water when soil is dry",
        humidity: "High humidity",
        temperature: "65-85°F", 
        wateringFrequencyHours: 2/60,
      }, // Ensure careInstructions always exists
      lastWatered: new Date().toISOString(),
    };

    const existingPlants = await AsyncStorage.getItem('my_plants');
    const plants = existingPlants ? JSON.parse(existingPlants) : [];
    plants.push(plant);
    await AsyncStorage.setItem('my_plants', JSON.stringify(plants));

    setTimeout(() => {
      router.replace('/');
    }, 100);
  } catch (error) {
    console.error('Error saving plant:', error);
  }
};

  

  const processImage = async (uri: string) => {
    try {
      console.log('Processing image:', uri);
      const manipResult = await manipulateAsync(
        uri,
        [{ resize: { width: 224, height: 224 } }],
        { format: SaveFormat.JPEG }
      );

      setCapturedImage(manipResult.uri);
      
      // Mock prediction for demo
      const mockPrediction: Prediction = {
        name: 'Monstera Deliciosa',
        confidence: 0.92,
        careInstructions: {
          water: 'Water when top 2-3 inches of soil is dry',
          light: 'Bright, indirect sunlight',
          humidity: 'High humidity (60-80%)',
          temperature: '65-85°F (18-29°C)',
          wateringFrequencyHours: 1/60,
        },
      };

      setPrediction(mockPrediction);

      const plant: Plant = {
        id: Date.now().toString(),
        name: mockPrediction.name,
        image: manipResult.uri,
        careInstructions: mockPrediction.careInstructions,
        dateAdded: new Date().toISOString(),
        lastWatered: new Date().toISOString(),
      };

      console.log('Saving plant:', plant);
      
      const existingPlants = await AsyncStorage.getItem('my_plants');
      const plants: Plant[] = existingPlants ? JSON.parse(existingPlants) : [];
      plants.push(plant);
      await AsyncStorage.setItem('my_plants', JSON.stringify(plants));

      setTimeout(() => {
        router.replace('/');
      }, 100);
    } catch (error) {
      console.error('Error processing image:', error);
    }
  };

  return (
    <View style={styles.container}>
      {isModelLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#22c55e" />
          <Text style={styles.loadingText}>Loading plant identification model...</Text>
        </View>
      ) : (
        <View style={styles.cameraContainer}>
          <CameraView 
            ref= {cameraRef}
            style={styles.camera} 
            facing={facing}
          >
            <View style={styles.overlay}>
              <View style={styles.targetFrame} />
              <View style={styles.controls}>
                <Pressable style={styles.button} onPress={pickImage}>
                  <ImageIcon size={24} color="#ffffff" />
                  <Text style={styles.buttonText}>Gallery</Text>
                </Pressable>
                <Pressable 
                  style={[styles.button, styles.captureButton]} 
                  onPress={takePhoto}
                >
                  <CameraIcon size={24} color="#ffffff" />
                  <Text style={styles.buttonText}>Capture</Text>
                </Pressable>
              </View>
            </View>
          </CameraView>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  cameraContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  camera: {
    height: '100%',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'space-between',
  },
  targetFrame: {
    width: 280,
    height: 280,
    alignSelf: 'center',
    marginTop: '25%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748b',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 40,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  button: {
    backgroundColor: '#22c55e',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 120,
    justifyContent: 'center',
  },
  captureButton: {
    backgroundColor: '#ef4444',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  message: {
    color: '#ffffff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
    padding: 20,
  },
});

