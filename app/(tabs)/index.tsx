import { useFocusEffect } from 'expo-router';
import { useEffect, useState, useRef } from 'react';
import { 
  View, Text, StyleSheet, FlatList, Image, 
  Pressable, Modal, PanResponder, Animated, Platform 
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts, Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { router } from 'expo-router';
import { Plus, Trash2 } from 'lucide-react-native';
import React from 'react';
import * as Notifications from 'expo-notifications';
import { format, parseISO, addHours } from 'date-fns';
import { RectButton, Swipeable } from 'react-native-gesture-handler';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import { SchedulableTriggerInputTypes } from 'expo-notifications';

// Define constants
const BACKGROUND_FETCH_TASK = 'background-plant-watering-check';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    priority: Notifications.AndroidNotificationPriority.HIGH,
  }),
});

// Define interfaces
interface Plant {
  id: string;
  name: string;
  image: string;
  careInstructions: {
    water: string;
    light: string;
    humidity: string;
    temperature: string;
    wateringFrequencyHours: number;
  };
  dateAdded: string;
  lastWatered: string;
}
const scheduleWateringNotification = async (plant: Plant) => {
  try {
    const lastWatered = new Date(plant.lastWatered);
    const wateringFrequencyMs = plant.careInstructions.wateringFrequencyHours * 60 * 60 * 1000;
    const nextWatering = new Date(lastWatered.getTime() + wateringFrequencyMs);
    const now = new Date();

    // Only schedule if next watering is in the future
    if (nextWatering > now) {
      // Cancel existing notification first
      await Notifications.cancelScheduledNotificationAsync(plant.id);
      
      // Schedule new notification with exact date
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `Time to water ${plant.name}!`,
          body: 'Your plant needs watering now.',
          data: { plantId: plant.id },
        },
        trigger: {
          type: SchedulableTriggerInputTypes.DATE,
          date: nextWatering
        },
        identifier: plant.id
      });

      console.log(`Scheduled notification for ${plant.name} at ${nextWatering.toLocaleString()}`);
      
      // Verify the notification was scheduled
      const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
      if (scheduledNotifications.find(n => n.identifier === plant.id)) {
        console.log('Notification successfully scheduled and verified');
      } else {
        console.warn('Notification may not have been scheduled properly');
      }
    }
  } catch (error) {
    console.error('Error scheduling notification:', error);
  }
};
// Update the background task definition
TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  try {
    const storedPlants = await AsyncStorage.getItem('my_plants');
    if (storedPlants) {
      const plants = JSON.parse(storedPlants);
      const now = new Date();
      
      // Get all currently scheduled notifications
      const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
      console.log('Background task: Current notifications:', scheduledNotifications.length);
      
      for (const plant of plants) {
        // Only schedule if we don't already have a notification for this plant
        const hasNotification = scheduledNotifications.find(n => n.identifier === plant.id);
        if (!hasNotification) {
          console.log('Background task: Rescheduling notification for', plant.name);
          // Your existing scheduleWateringNotification function will handle this
          await scheduleWateringNotification(plant);
        }
      }
    }
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error('Error in background task:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export default function MyPlantsScreen() {
  // Group all hooks at the top
  const [plants, setPlants] = useState<Plant[]>([]);
  const [selectedPlant, setSelectedPlant] = useState<Plant | null>(null);
  const [fontsLoaded] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-SemiBold': Inter_600SemiBold,
  });
  
  const swipeableRefs = useRef<Map<string, Swipeable>>(new Map());
  const currentlyOpenSwipeable = useRef<Swipeable | null>(null);

  // Notification scheduling function
  

  // Setup effect
  useEffect(() => {
    const setup = async () => {
      // Request permissions
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        alert('Please enable notifications to receive watering reminders!');
        return;
      }

      // Set up notification channel for Android
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('plant-watering', {
          name: 'Plant Watering Reminders',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#22c55e',
        });
      }
    };

    setup();
  }, []);

  // Notification listeners effect
  useEffect(() => {
    const notificationListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
    });

    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response received:', response);
    });

    return () => {
      Notifications.removeNotificationSubscription(notificationListener);
      Notifications.removeNotificationSubscription(responseListener);
    };
  }, []);

  // Load plants effect
  useFocusEffect(
    React.useCallback(() => {
      loadPlants();
    }, [])
  );

  // Helper functions
  const closeOpenSwipeable = () => {
    if (currentlyOpenSwipeable.current) {
      currentlyOpenSwipeable.current.close();
      currentlyOpenSwipeable.current = null;
    }
  };

  const loadPlants = async () => {
    try {
      const storedPlants = await AsyncStorage.getItem('my_plants');
      if (storedPlants) {
        const loadedPlants = JSON.parse(storedPlants);
        setPlants(loadedPlants);
        
        // Get all currently scheduled notifications
        const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
        console.log('Current scheduled notifications:', scheduledNotifications);
        
        // Schedule notifications for plants that need them
        for (const plant of loadedPlants) {
          const lastWatered = new Date(plant.lastWatered);
          const nextWatering = addHours(lastWatered, plant.careInstructions.wateringFrequencyHours);
          const now = new Date();
          
          const timeUntilWatering = nextWatering.getTime() - now.getTime();
          if (timeUntilWatering > 60000) {
            const existingNotification = scheduledNotifications.find(n => n.identifier === plant.id);
            if (!existingNotification) {
              await scheduleWateringNotification(plant);
            }
          } else {
            console.log(`Skipping notification for ${plant.name} - next watering too soon or in past`);
          }
        }
      }
    } catch (error) {
      console.error('Error loading plants:', error);
    }
  };
  const deletePlant = async (plantId: string) => {
    try {
      // Cancel the notification for this plant
      await Notifications.cancelScheduledNotificationAsync(plantId);
      
      const storedPlants = await AsyncStorage.getItem('my_plants');
      if (storedPlants) {
        const plants: Plant[] = JSON.parse(storedPlants);
        const updatedPlants = plants.filter(plant => plant.id !== plantId);
        await AsyncStorage.setItem('my_plants', JSON.stringify(updatedPlants));
        setPlants(updatedPlants);
        setSelectedPlant(null); // Close modal after delete
      }
    } catch (error) {
      console.error('Error deleting plant:', error);
    }
  };
  
  // Render the right actions (delete button) for the swipeable
  const renderRightActions = (plantId: string) => {
    return (
      <RectButton
        style={styles.deleteAction}
        onPress={() => deletePlant(plantId)}
      >
        <Trash2 size={24} color="#ffffff" />
        <Text style={styles.deleteActionText}>Delete</Text>
      </RectButton>
    );
  };

  if (!fontsLoaded) {
    return null;
  }


  const PlantDetailsModal = ({ plant }: { plant: Plant }) => {
    
    const panY = useRef(new Animated.Value(0)).current;
    const translateY = panY.interpolate({
      inputRange: [-1, 0, 1],
      outputRange: [0, 0, 1],
    });

    const panResponder = useRef(
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderMove: (_, gestureState) => {
          if (gestureState.dy > 0) {
            panY.setValue(gestureState.dy);
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dy > 50) {
            setSelectedPlant(null);
          } else {
            Animated.spring(panY, {
              toValue: 0,
              useNativeDriver: true,
            }).start();
          }
        },
      })
    ).current;
  
    // Add better error handling for dates
    const lastWatered = plant.lastWatered || new Date().toISOString();
    const wateringFrequency = plant.careInstructions?.wateringFrequencyHours || 7;

    let nextWateringDate;
    let formattedLastWatered;
    let formattedNextWatering;

try {
  // Convert hours to days for display
  const wateringFrequencyInDays = Math.floor(wateringFrequency / 24);
  nextWateringDate = addHours(parseISO(lastWatered), wateringFrequency);
  formattedLastWatered = format(parseISO(lastWatered), 'MMM d, yyyy');
  formattedNextWatering = format(nextWateringDate, 'MMM d, yyyy');
} catch (error) {
      console.error('Error formatting dates:', error);
      nextWateringDate = new Date();
      formattedLastWatered = 'Not set';
      formattedNextWatering = 'Not set';
    }

    return (
      <Modal>
        <Pressable style={styles.modalOverlay}>
          <Animated.View style={[styles.modalContent, { transform: [{ translateY }] }]} {...panResponder.panHandlers}>
            <View style={styles.modalHandle} />
            <Image source={{ uri: plant.image }} style={styles.modalImage} />
            <View style={styles.modalDetails}>
              <Text style={styles.modalTitle}>{plant.name}</Text>
              
              <View style={styles.careSection}>
                <Text style={styles.sectionTitle}>Care Instructions</Text>
                
                <View style={styles.careItem}>
                  <Text style={styles.careLabel}>Water:</Text>
                  <Text style={styles.careText}>{plant.careInstructions.water}</Text>
                </View>
                
                <View style={styles.careItem}>
                  <Text style={styles.careLabel}>Light:</Text>
                  <Text style={styles.careText}>{plant.careInstructions.light}</Text>
                </View>
                
                <View style={styles.careItem}>
                  <Text style={styles.careLabel}>Humidity:</Text>
                  <Text style={styles.careText}>{plant.careInstructions.humidity}</Text>
                </View>
                
                <View style={styles.careItem}>
                  <Text style={styles.careLabel}>Temperature:</Text>
                  <Text style={styles.careText}>{plant.careInstructions.temperature}</Text>
                </View>
              </View>

              <View style={styles.buttonContainer}>
                <Pressable 
                  style={styles.closeButton} 
                  onPress={() => setSelectedPlant(null)}
                >
                  <Text style={styles.closeButtonText}>Close</Text>
                </Pressable>
              </View>
            </View>
          </Animated.View>
        </Pressable>
      </Modal>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Plants</Text>
        <Pressable
          style={styles.addButton}
          onPress={() => router.replace('/identify')}
        >
          <Plus size={24} color="#ffffff" />
        </Pressable>
      </View>

      {plants.length === 0 ? (
        <View style={styles.emptyState}>
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=800' }}
            style={styles.emptyStateImage}
          />
          <Text style={styles.emptyStateText}>
            No plants added yet. Tap the + button to identify your first plant!
          </Text>
        </View>
      ) : (
        <>
          <FlatList
            data={plants}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Swipeable
                ref={(ref) => {
                  if (ref) {
                    swipeableRefs.current.set(item.id, ref);
                  } else {
                    swipeableRefs.current.delete(item.id);
                  }
                }}
                renderRightActions={() => renderRightActions(item.id)}
                onSwipeableOpen={() => {
                  closeOpenSwipeable();
                  currentlyOpenSwipeable.current = swipeableRefs.current.get(item.id) || null;
                }}
                rightThreshold={50}
                friction={2}
                containerStyle={styles.swipeableContainer}
              >
                <Pressable
                  style={styles.plantCard}
                  onPress={() => {
                    closeOpenSwipeable();
                    setSelectedPlant(item);
                  }}
                >
                  <Image source={{ uri: item.image }} style={styles.plantImage} />
                  <View style={styles.plantInfo}>
                    <Text style={styles.plantName}>{item.name}</Text>
                    <Text style={styles.plantSpecies}>{item.careInstructions.light}</Text>
                  </View>
                </Pressable>
              </Swipeable>
            )}
            contentContainerStyle={styles.listContent}
            onScroll={closeOpenSwipeable}
          />
          {selectedPlant && <PlantDetailsModal plant={selectedPlant} />}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#ffffff',
  },
  title: {
    fontSize: 28,
    fontFamily: 'Inter-SemiBold',
    color: '#0f172a',
  },
  addButton: {
    backgroundColor: '#22c55e',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyStateImage: {
    width: 200,
    height: 200,
    borderRadius: 100,
    marginBottom: 20,
  },
  emptyStateText: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    maxWidth: 300,
  },
  listContent: {
    padding: 16,
  },
  swipeableContainer: {
    marginBottom: 16,
  },
  plantCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    flexDirection: 'row',
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  plantImage: {
    width: 100,
    height: 100,
    resizeMode: 'cover',
  },
  plantInfo: {
    flex: 1,
    padding: 16,
  },
  plantName: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 18,
    color: '#0f172a',
    marginBottom: 4,
  },
  plantSpecies: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#64748b',
  },
  deleteAction: {
    backgroundColor: '#ef4444',
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    width: 100,
    height: '100%',
  },
  deleteActionText: {
    color: 'white',
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#cbd5e1',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingTop: 8,
    overflow: 'scroll',
  },
  modalImage: {
    width: '100%',
    height: undefined,
    aspectRatio: 1,
    maxHeight: 300,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalDetails: {
    padding: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontFamily: 'Inter-SemiBold',
    color: '#0f172a',
    marginBottom: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  closeButton: {
    flex: 1,
    backgroundColor: '#64748b',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  deleteButton: {
    flex: 1,
    backgroundColor: '#ef4444',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  careSection: {
    marginBottom: 20,
  },
  careItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  careLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: '#0f172a',
  },
  careText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#64748b',
  },
  sectionTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 18,
    color: '#0f172a',
    marginBottom: 12,
  },
});

