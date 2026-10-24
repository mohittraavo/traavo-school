import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

type Props = { children: React.ReactNode };
type State = { error: Error | null; attempt: number };

export class LoadableErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, attempt: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  reload = () => {
    this.setState((current) => ({ error: null, attempt: current.attempt + 1 }));
  };

  render() {
    if (this.state.error) {
      return <ErrorFallback error={this.state.error} onReload={this.reload} />;
    }
    return <View key={this.state.attempt} style={{ flex: 1 }}>{this.props.children}</View>;
  }
}

function ErrorFallback({ error, onReload }: { error: Error; onReload: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 }}>
      <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', textAlign: 'center' }}>This screen could not load</Text>
      <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>{error.message || 'Something went wrong while rendering this page.'}</Text>
      <Pressable onPress={onReload} style={{ marginTop: 8, backgroundColor: colors.brand, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 }}>
        <Text style={{ color: colors.onBrand, fontWeight: '700' }}>Reload</Text>
      </Pressable>
    </View>
  );
}
