import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { Zap, Mail, Lock, User, Eye, EyeOff } from 'lucide-react-native';

type AuthMode = 'signin' | 'signup' | 'forgot';

export const AuthScreen: React.FC = () => {
  const { signInWithEmail, signUpWithEmail, resetPassword, isLoading } = useAuth();
  
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; name?: string }>({});

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: typeof errors = {};
    
    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Invalid email format';
    }
    
    if (mode !== 'forgot') {
      if (!password) {
        newErrors.password = 'Password is required';
      } else if (password.length < 6) {
        newErrors.password = 'Password must be at least 6 characters';
      }
    }
    
    if (mode === 'signup' && !displayName.trim()) {
      newErrors.name = 'Display name is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle email auth
  const handleEmailAuth = async () => {
    if (!validateForm()) return;
    
    let result;
    
    if (mode === 'signin') {
      result = await signInWithEmail(email.trim(), password);
      if (result.error) {
        Alert.alert('Sign In Error', result.error.message || 'Invalid email or password');
      }
    } else if (mode === 'signup') {
      result = await signUpWithEmail(email.trim(), password, displayName.trim());
      if (result.error) {
        Alert.alert('Sign Up Error', result.error.message || 'An error occurred');
      } else {
        Alert.alert(
          'Check Your Email',
          'We sent you a confirmation link. Please verify your email to continue.',
          [{ text: 'OK', onPress: () => setMode('signin') }]
        );
      }
    } else if (mode === 'forgot') {
      result = await resetPassword(email.trim());
      if (result.error) {
        Alert.alert('Error', result.error.message || 'Failed to send reset email');
      } else {
        Alert.alert(
          'Email Sent',
          'Check your email for a password reset link.',
          [{ text: 'OK', onPress: () => setMode('signin') }]
        );
      }
    }
  };

  // Get title based on mode
  const getTitle = () => {
    switch (mode) {
      case 'signin': return 'Welcome Back';
      case 'signup': return 'Create Account';
      case 'forgot': return 'Reset Password';
    }
  };

  // Get button text based on mode
  const getButtonText = () => {
    switch (mode) {
      case 'signin': return 'Sign In';
      case 'signup': return 'Create Account';
      case 'forgot': return 'Send Reset Link';
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        {/* Logo / Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Zap size={48} color={Colors.primary} />
          </View>
          <Text style={styles.title}>APEX</Text>
          <Text style={styles.subtitle}>{getTitle()}</Text>
        </View>

        {/* Auth Form */}
        <View style={styles.form}>
          {/* Display Name (signup only) */}
          {mode === 'signup' && (
            <View style={styles.inputContainer}>
              <User size={20} color={Colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Display Name"
                placeholderTextColor={Colors.textSecondary}
                value={displayName}
                onChangeText={setDisplayName}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>
          )}
          {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}

          {/* Email */}
          <View style={styles.inputContainer}>
            <Mail size={20} color={Colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={Colors.textSecondary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}

          {/* Password (not for forgot mode) */}
          {mode !== 'forgot' && (
            <View style={styles.inputContainer}>
              <Lock size={20} color={Colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={Colors.textSecondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
              >
                {showPassword ? (
                  <EyeOff size={20} color={Colors.textSecondary} />
                ) : (
                  <Eye size={20} color={Colors.textSecondary} />
                )}
              </TouchableOpacity>
            </View>
          )}
          {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}

          {/* Forgot Password Link (signin only) */}
          {mode === 'signin' && (
            <TouchableOpacity 
              onPress={() => setMode('forgot')} 
              style={styles.forgotButton}
            >
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>
          )}

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={handleEmailAuth}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={Colors.textPrimary} />
            ) : (
              <Text style={styles.buttonText}>{getButtonText()}</Text>
            )}
          </TouchableOpacity>

          {/* Toggle Mode Links */}
          <View style={styles.toggleContainer}>
            {mode === 'signin' && (
              <TouchableOpacity onPress={() => setMode('signup')}>
                <Text style={styles.toggleText}>
                  Don't have an account? <Text style={styles.toggleLink}>Sign Up</Text>
                </Text>
              </TouchableOpacity>
            )}
            
            {mode === 'signup' && (
              <TouchableOpacity onPress={() => setMode('signin')}>
                <Text style={styles.toggleText}>
                  Already have an account? <Text style={styles.toggleLink}>Sign In</Text>
                </Text>
              </TouchableOpacity>
            )}
            
            {mode === 'forgot' && (
              <TouchableOpacity onPress={() => setMode('signin')}>
                <Text style={styles.toggleText}>
                  Remember your password? <Text style={styles.toggleLink}>Sign In</Text>
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Footer */}
        <Text style={styles.footerText}>
          By continuing, you agree to our Terms of Service
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  title: {
    fontSize: 36,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: 4,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 8,
  },
  form: {
    marginBottom: 24,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.secondary,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inputIcon: {
    marginLeft: 16,
  },
  input: {
    flex: 1,
    height: 52,
    paddingHorizontal: 12,
    color: Colors.textPrimary,
    fontSize: 16,
  },
  eyeButton: {
    padding: 16,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 12,
    marginTop: -8,
    marginBottom: 8,
    marginLeft: 4,
  },
  forgotButton: {
    alignSelf: 'flex-end',
    marginBottom: 8,
  },
  forgotText: {
    color: Colors.primary,
    fontSize: 14,
  },
  button: {
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
  },
  buttonText: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  toggleContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  toggleText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  toggleLink: {
    color: Colors.primary,
    fontWeight: '600',
  },
  footerText: {
    color: Colors.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 24,
  },
});
