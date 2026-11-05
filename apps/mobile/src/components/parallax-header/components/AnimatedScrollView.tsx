import { Animated } from 'react-native';
import { HEADER_HEIGHT, IMG_HEADER_HEIGHT } from '@/components/parallax-header/constants';
import { useAnimateScrollView } from '@/components/parallax-header/hooks/useAnimatedScrollView';
import type { AnimatedScrollViewProps } from '@/components/parallax-header/types/index';
import { AnimatedHeader } from './AnimatedHeader';
import AnimatedNavbar from './AnimatedNavBar';

export function AnimatedScrollView({
  TopNavBarComponent,
  HeaderNavbarComponent,
  HeaderComponent,
  headerMaxHeight,
  topBarHeight,
  topBarElevation,
  headerImage,
  disableScale,
  children,
  imageStyle,
  renderHeaderComponent,
  OverlayHeaderContent,
  renderOveralComponent,
  renderTopNavBarComponent,
  renderToHardwareTextureAndroid,
  renderHeaderNavBarComponent,
  ref,
  ...props
}: AnimatedScrollViewProps) {
  const imageHeight = headerMaxHeight || IMG_HEADER_HEIGHT;
  const headerNavHeight = topBarHeight || HEADER_HEIGHT;
  const headerElevation = topBarElevation || 0;
  const [scroll, onScroll, scale, translateYDown, translateYUp] = useAnimateScrollView(
    imageHeight,
    disableScale
  );

  return (
    <>
      <Animated.ScrollView
        ref={ref}
        scrollEnabled={true}
        onScroll={onScroll}
        scrollEventThrottle={16}
        {...props}
      >
        <AnimatedHeader
          HeaderComponent={renderHeaderComponent ? renderHeaderComponent() : HeaderComponent}
          headerImage={headerImage}
          imageStyle={imageStyle}
          imageHeight={imageHeight}
          translateYDown={translateYDown}
          translateYUp={translateYUp}
          scale={scale}
          OverlayHeaderContent={
            renderOveralComponent ? renderOveralComponent() : OverlayHeaderContent
          }
        />
        {children}
      </Animated.ScrollView>
      <AnimatedNavbar
        headerElevation={headerElevation}
        headerHeight={headerNavHeight}
        scroll={scroll}
        imageHeight={imageHeight}
        OverflowHeaderComponent={
          renderHeaderNavBarComponent ? renderHeaderNavBarComponent() : HeaderNavbarComponent
        }
        TopNavbarComponent={
          renderTopNavBarComponent ? renderTopNavBarComponent() : TopNavBarComponent
        }
      />
    </>
  );
}
