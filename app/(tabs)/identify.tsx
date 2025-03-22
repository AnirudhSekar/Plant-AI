import * as FileSystem from 'expo-file-system';
import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Modal, Alert } from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Camera as CameraIcon, Image as ImageIcon } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import { identifyPlant } from '../utils/plantApi';

interface CareInstructions {
  water: string;
  light: string;
  humidity: string;
  temperature: string;
  wateringFrequencyHours: number;
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
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [processedPlant, setProcessedPlant] = useState<Plant | null>(null);
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    if (permission && permission.granted) {
      requestPermission();
    }
  }, []);
  const processImage = async (uri: string) => {
    try {
      setIsProcessing(true);
  
      // Convert image to base64
      const base64Image = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
  
      // Get plant identification from Plant.id API
      const identification = await identifyPlant(base64Image);
      console.log('Plant identification result:', identification);
  
      const plant: Plant = {
        id: Date.now().toString(),
        name: identification.name,
        image: uri,
        careInstructions: identification.careInstructions,
        dateAdded: new Date().toISOString(),
        lastWatered: new Date().toISOString(),
      };
  
      setProcessedPlant(plant);
      setShowConfirmation(true);
  
    } catch (error: any) {
      console.error('Error processing image:', error);
      Alert.alert(
        'Identification Error',
        error.message || 'Failed to identify plant. Please try again with a clearer photo.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsProcessing(false);
    }
  };



  const savePlant = async () => {
    try {
      if (!processedPlant) return;

      const existingPlants = await AsyncStorage.getItem('my_plants');
      const plants = existingPlants ? JSON.parse(existingPlants) : [];
      plants.push(processedPlant);
      await AsyncStorage.setItem('my_plants', JSON.stringify(plants));

      setShowConfirmation(false);
      setProcessedPlant(null);
      router.replace('/');
    } catch (error) {
      console.error('Error saving plant:', error);
      Alert.alert('Error', 'Failed to save plant. Please try again.');
    }
  };

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
        await processImage(photo.uri);
      }
    } catch (error) {
      console.error('Failed to take photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

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

  return (
    <View style={styles.container}>
      {isProcessing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#22c55e" />
          <Text style={styles.loadingText}>Processing image...</Text>
        </View>
      ) : (
        <View style={styles.cameraContainer}>
          <CameraView 
            ref={cameraRef}
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

      <Modal
        visible={showConfirmation}
        transparent={true}
        animationType="slide"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Plant Identified!</Text>
            {processedPlant && (
              <>
                <Text style={styles.plantName}>{processedPlant.name}</Text>
                <Text style={styles.careInstructions}>
                  Water: {processedPlant.careInstructions.water}{'\n'}
                  Light: {processedPlant.careInstructions.light}{'\n'}
                  Temperature: {processedPlant.careInstructions.temperature}
                </Text>
              </>
            )}
            <View style={styles.modalButtons}>
              <Pressable 
                style={[styles.button, styles.cancelButton]}
                onPress={() => setShowConfirmation(false)}
              >
                <Text style={styles.buttonText}>Try Again</Text>
              </Pressable>
              <Pressable 
                style={styles.button}
                onPress={savePlant}
              >
                <Text style={styles.buttonText}>Save Plant</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
  </View>

  )}

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
  cancelButton: {
    backgroundColor: '#64748b',
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
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    width: '80%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 16,
  },
  plantName: {
    fontSize: 20,
    fontWeight: '500',
    color: '#22c55e',
    marginBottom: 12,
  },
  careInstructions: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
});