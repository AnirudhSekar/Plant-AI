import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Image, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts, Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { Droplets } from 'lucide-react-native';
import { addDays, format, addHours, addMinutes } from 'date-fns';
import { useFocusEffect } from 'expo-router';
import React from 'react';




interface Plant {
  id: string;
  name: string;
  image: string;
  careInstructions: {
    wateringFrequencyHours: number;
  };
  lastWatered: string;
}

export default function RemindersScreen() {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [fontsLoaded] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-SemiBold': Inter_600SemiBold,
  });

  useEffect(() => {
    // Initial setup
    loadPlants();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadPlants();
    }, [])
  );

  const loadPlants = async () => {
    try {
      const storedPlants = await AsyncStorage.getItem('my_plants');
      if (storedPlants) {
        const loadedPlants = JSON.parse(storedPlants);
        // Ensure plants array is valid
        if (Array.isArray(loadedPlants)) {
          // Sort plants by next watering date
          const sortedPlants = loadedPlants.sort((a, b) => {
            const aNext = getNextWateringDate(a);
            const bNext = getNextWateringDate(b);
            return aNext.getTime() - bNext.getTime();
          });
          setPlants(sortedPlants);
        } else {
          console.error('Stored plants is not an array:', loadedPlants);
          setPlants([]);
        }
      }
    } catch (error) {
      console.error('Error loading plants:', error);
      setPlants([]);
    }
  };
  const getNextWateringDate = (plant: Plant) => {
    try {
      const lastWateredDate = plant.lastWatered ? 
        new Date(plant.lastWatered) : 
        new Date();
      const minutes = Math.round(plant.careInstructions.wateringFrequencyHours * 60);
      return addMinutes(lastWateredDate, minutes);
    } catch (error) {
      console.error('Error calculating next watering date:', error);
      return new Date();
    }
  };
  useEffect(() => {
    console.log('Current plants in state:', plants);
  }, [plants]);

  const getFrequencyText = (hours: number) => {
    if (hours < 1/60) {
      const seconds = Math.round(hours * 3600);
      return `Water every ${seconds} second${seconds === 1 ? '' : 's'}`;
    }
    if (hours < 1) {
      const minutes = Math.round(hours * 60);
      return `Water every ${minutes} minute${minutes === 1 ? '' : 's'}`;
    }
    if (hours < 24) {
      return `Water every ${hours} hour${hours === 1 ? '' : 's'}`;
    }
    const days = hours / 24;
    if (Number.isInteger(days)) {
      return `Water every ${days} day${days === 1 ? '' : 's'}`;
    }
    return `Water every ${days.toFixed(1)} days`;
  };

  if (!fontsLoaded) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Watering Schedule</Text>
      
      {plants.length === 0 ? (
        <View style={styles.emptyState}>
          <Droplets size={48} color="#22c55e" />
          <Text style={styles.emptyStateText}>
            No plants added yet. Add plants to see their watering schedule!
          </Text>
        </View>
      ) : (
        <FlatList
          data={plants}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            let nextWateringDate;
            let formattedNextWatering;

            try {
              const lastWateredDate = item.lastWatered ? 
                new Date(item.lastWatered) : 
                new Date();

              if (isNaN(lastWateredDate.getTime())) {
                throw new Error('Invalid last watered date');
              }

              const minutes = Math.round(item.careInstructions.wateringFrequencyHours * 60);
              nextWateringDate = addMinutes(lastWateredDate, minutes);

              formattedNextWatering = format(nextWateringDate, 'MMM d, yyyy h:mm a');
            } catch (error) {
              console.error('Error handling dates:', error);
              nextWateringDate = new Date();
              formattedNextWatering = 'Date not set';
            }

            return (
              <View style={styles.reminderCard}>
                <Image 
                  source={{ uri: item.image }} 
                  style={styles.plantImage} 
                />
                <View style={styles.reminderInfo}>
                  <Text style={styles.plantName}>{item.name}</Text>
                  <Text style={styles.frequency}>
                    {getFrequencyText(item.careInstructions.wateringFrequencyHours || 24)}
                  </Text>
                  <Text style={styles.nextWatering}>
                    Next: {formattedNextWatering}
                  </Text>
                </View>
              </View>
            );
          }}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Inter-SemiBold',
    color: '#0f172a',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyStateText: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 16,
    maxWidth: 300,
  },
  listContent: {
    padding: 16,
  },
  reminderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 16,
    flexDirection: 'row',
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  plantImage: {
    width: 120,
    height: 120,
    resizeMode: 'cover',
  },
  reminderInfo: {
    flex: 1,
    padding: 16,
  },
  plantName: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 18,
    color: '#0f172a',
    marginBottom: 4,
  },
  frequency: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#64748b',
    marginBottom: 4,
  },
  nextWatering: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#64748b',
  },
});