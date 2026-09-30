interface GoogleCredentialResponse {
  credential: string
}

interface GooglePromptMomentNotification {
  getNotDisplayedReason?: () => string
  getSkippedReason?: () => string
  isNotDisplayed: () => boolean
  isSkippedMoment: () => boolean
}

interface GoogleAccountsId {
  disableAutoSelect: () => void
  initialize: (configuration: {
    callback: (response: GoogleCredentialResponse) => void
    client_id: string
    cancel_on_tap_outside?: boolean
  }) => void
  prompt: (callback?: (notification: GooglePromptMomentNotification) => void) => void
  renderButton: (
    element: HTMLElement,
    configuration: {
      shape?: 'rectangular' | 'pill' | 'circle' | 'square'
      size?: 'large' | 'medium' | 'small'
      text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
      theme?: 'outline' | 'filled_blue' | 'filled_black'
      type?: 'standard' | 'icon'
      width?: number
    },
  ) => void
}

interface Window {
  google?: {
    accounts: {
      id: GoogleAccountsId
    }
  }
}
