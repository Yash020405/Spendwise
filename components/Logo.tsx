import React from 'react';
import { View, Image } from 'react-native';

interface LogoProps {
    size?: number;
    width?: number;
    height?: number;
    style?: any;
}

// Logo component using PNG image
export const Logo: React.FC<LogoProps> = ({ size, width, height, style }) => {
    // Aspect ratio based on logo dimensions
    const aspectRatio = 459 / 543;
    
    let finalWidth: number;
    let finalHeight: number;
    
    if (width && height) {
        finalWidth = width;
        finalHeight = height;
    } else if (width) {
        finalWidth = width;
        finalHeight = width / aspectRatio;
    } else if (height) {
        finalHeight = height;
        finalWidth = height * aspectRatio;
    } else if (size) {
        // Size refers to the height
        finalHeight = size;
        finalWidth = size * aspectRatio;
    } else {
        finalWidth = 50;
        finalHeight = 60;
    }

    return (
        <View style={style}>
            <Image
                source={require('../assets/images/logo.png')}
                style={{ width: finalWidth, height: finalHeight }}
                resizeMode="contain"
            />
        </View>
    );
};

export default Logo;
