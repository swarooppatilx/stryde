import { useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BorderRadius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getInitials } from '@/utils/format';

interface UserAvatarProps {
  uri?: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg' | number;
  borderColor?: string;
}

const SIZE_MAP = { sm: 32, md: 44, lg: 64 };

export function UserAvatar({ uri, name, size = 'md', borderColor }: UserAvatarProps) {
  const theme = useTheme();
  const [imgError, setImgError] = useState(false);
  const [imgLoading, setImgLoading] = useState(false);

  const pixelSize = typeof size === 'number' ? size : SIZE_MAP[size];
  const showImage = uri && !imgError;

  return (
    <View
      style={[
        styles.container,
        {
          width: pixelSize,
          height: pixelSize,
          borderRadius: BorderRadius.full,
          backgroundColor: theme.brand.primaryTint,
          borderColor: borderColor ?? 'transparent',
        },
      ]}
    >
      {showImage ? (
        <>
          {imgLoading && (
            <ActivityIndicator size="small" color={theme.brand.primary} style={styles.loader} />
          )}
          <Image
            source={{ uri }}
            style={[
              styles.image,
              {
                width: pixelSize,
                height: pixelSize,
                borderRadius: BorderRadius.full,
                opacity: imgLoading ? 0 : 1,
              },
            ]}
            onLoadStart={() => setImgLoading(true)}
            onLoadEnd={() => setImgLoading(false)}
            onError={() => {
              setImgLoading(false);
              setImgError(true);
            }}
            accessibilityLabel={`Avatar for ${name}`}
          />
        </>
      ) : (
        <ThemedText
          type="smallBold"
          style={{ color: theme.brand.primary, fontSize: pixelSize * 0.38 }}
        >
          {getInitials(name)}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  loader: {
    position: 'absolute',
  },
});
