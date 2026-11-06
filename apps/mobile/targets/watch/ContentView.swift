import HealthKit
import SwiftUI

struct ContentView: View {
  @EnvironmentObject private var workout: WorkoutManager

  var body: some View {
    if workout.isActive {
      WorkoutView()
    } else {
      VStack(spacing: 8) {
        Image(systemName: "figure.run")
          .font(.system(size: 34))
          .foregroundStyle(Color.accentColor)
        Text("Start a recording in Stryde on your iPhone")
          .font(.footnote)
          .multilineTextAlignment(.center)
      }
      .padding()
    }
  }
}

/// The live numbers, with pause and end. Ending here ends the recording on the phone too.
struct WorkoutView: View {
  @EnvironmentObject private var workout: WorkoutManager

  var body: some View {
    TimelineView(.periodic(from: .now, by: 1)) { context in
      VStack(alignment: .leading, spacing: 2) {
        Text(elapsed(at: context.date))
          .font(.system(.title2, design: .rounded).monospacedDigit())
          .foregroundStyle(Color.accentColor)
        HStack(alignment: .firstTextBaseline, spacing: 4) {
          Text(workout.heartRate > 0 ? "\(Int(workout.heartRate))" : "--")
            .font(.system(size: 40, weight: .bold, design: .rounded).monospacedDigit())
          Image(systemName: "heart.fill").foregroundStyle(.red).font(.caption)
        }
        Text(String(format: "%.2f km", workout.distance / 1000))
          .font(.system(.title3, design: .rounded).monospacedDigit())
        Text(paceOrSpeed)
          .font(.footnote.monospacedDigit())
          .foregroundStyle(.secondary)
        HStack {
          Button {
            workout.state == .paused ? workout.resume() : workout.pause()
          } label: {
            Image(systemName: workout.state == .paused ? "play.fill" : "pause.fill")
          }
          .accessibilityLabel(workout.state == .paused ? "Resume" : "Pause")
          Button(role: .destructive) {
            workout.end()
          } label: {
            Image(systemName: "stop.fill")
          }
          .accessibilityLabel("End")
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
  }

  private func elapsed(at date: Date) -> String {
    let seconds = Int(max(0, workout.elapsed(at: date)))
    let h = seconds / 3600
    let m = (seconds % 3600) / 60
    let s = seconds % 60
    return h > 0 ? String(format: "%d:%02d:%02d", h, m, s) : String(format: "%d:%02d", m, s)
  }

  private var paceOrSpeed: String {
    guard workout.speed > 0.3 else { return "--" }
    if workout.cycling { return String(format: "%.1f km/h", workout.speed * 3.6) }
    let secondsPerKm = 1000 / workout.speed
    return String(format: "%d:%02d /km", Int(secondsPerKm) / 60, Int(secondsPerKm) % 60)
  }
}
