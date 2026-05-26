import { View, Text, ActivityIndicator, Image, StyleSheet } from 'react-native';

export default function EventSplashScreen() {
  return (
    <View style={styles.customSplashContainer}>
      <Image 
        source={require('../../assets/React-icon.png')}
        style={styles.logo} 
      />
      <Text style={styles.loadingText}>Starting...</Text>
      <ActivityIndicator size="large" color="#0000ff" />
    </View>
  );
}

const styles = StyleSheet.create({
  customSplashContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff', 
  },
  logo: {
    height: 100,
    marginBottom: 20,
    aspectRatio: 1,
    resizeMode: 'contain',
  },
  loadingText: {
    fontFamily: 'PlusJakartaSans_700Bold', 
    fontSize: 18,
    color: '#333333',
    marginBottom: 20,
  }
});