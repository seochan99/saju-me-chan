import AnalyzeCard from './components/analyze/AnalyzeCard'
import AuthScreen from './components/layout/AuthScreen'
import GuestBar from './components/layout/GuestBar'
import PageHeader from './components/layout/PageHeader'
import ProfileModal from './components/profile/ProfileModal'
import ResultSection from './components/result/ResultSection'
import Sidebar from './components/layout/Sidebar'
import ToastArea from './components/shared/ToastArea'
import useSajuApp from './hooks/useSajuApp'
import './styles/app.css'

export default function App() {
  const app = useSajuApp()

  if (app.isAuthLoading) {
    return <AuthScreen />
  }

  return (
    <div className={`app-shell${app.isGuest ? ' app-shell--guest' : ''}`}>
      {app.isGuest ? (
        <GuestBar onSignIn={app.handleGoogleSignIn} isSigningIn={app.isSigningIn} />
      ) : (
        <Sidebar
          userLabel={app.userLabel}
          readings={app.readings}
          selectedId={app.selectedId}
          isBusy={app.isBusy}
          hasProfile={Boolean(app.profile)}
          isListLoading={app.isListLoading}
          isProfileLoading={app.isProfileLoading}
          onOpenProfile={app.openProfileEditor}
          onSignOut={app.handleSignOut}
          onNewReading={app.handleNewReading}
          onSelectReading={app.handleSelectReading}
          onDeleteReading={app.handleDeleteReading}
        />
      )}

      <div className="page">
        <PageHeader isGuest={app.isGuest} readingCount={app.readingCount} />

        <AnalyzeCard
          isGuest={app.isGuest}
          isBusy={app.isBusy}
          isViewingSaved={app.isViewingSaved}
          isSharing={app.isSharing}
          canShare={app.canShare}
          canAnalyze={app.canAnalyze}
          submitLabel={app.submitLabel}
          guestForm={app.guestForm}
          onGuestFormChange={app.setGuestForm}
          isProfileLoading={app.isProfileLoading}
          profile={app.profile}
          selectedId={app.selectedId}
          onShare={app.handleShare}
          onNewReading={app.handleNewReading}
          onDeleteSelected={(event) => app.handleDeleteReading(app.selectedId, event)}
          onOpenProfile={app.openProfileEditor}
          onAnalyze={app.handleAnalyze}
        />

        {app.error && !app.profileModalMode && <p className="error">{app.error}</p>}

        <ResultSection
          isLoading={app.isLoading}
          result={app.result}
          resultTitle={app.resultTitle}
          bakeStep={app.bakeStep}
          gate={app.gate}
          canShare={app.canShare}
          isBusy={app.isBusy}
          isSharing={app.isSharing}
          onShare={app.handleShare}
          onSignIn={app.handleGoogleSignIn}
          isSigningIn={app.isSigningIn}
        />
      </div>

      {app.profileModalMode && (
        <ProfileModal
          mode={app.profileModalMode}
          form={app.profileForm}
          onChange={app.setProfileForm}
          error={app.error}
          isSaving={app.isSavingProfile}
          canSave={app.canSaveProfile}
          nameInputRef={app.profileNameRef}
          onClose={app.closeProfileModal}
          onSubmit={app.handleSaveProfile}
        />
      )}

      <ToastArea toast={app.toast} />
    </div>
  )
}
