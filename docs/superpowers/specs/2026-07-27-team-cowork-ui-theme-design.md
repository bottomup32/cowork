# Team Cowork UI Theme Design

**Date:** 2026-07-27  
**Status:** Approved direction, pending written-spec review

## 1. Goal

Team Cowork should feel like a calm, focused desktop workspace rather than a
colorful consumer chat app. The supplied reference establishes the visual
direction: a bright monochrome shell, generous whitespace, fine borders, a
persistent left navigation, a centered work area, and a command composer that
remains close at hand.

The product will use its own information architecture and branding. The
reference is a mood and layout guide, not a screen to copy.

## 2. Chosen Direction

Three levels of gradient use were considered:

1. **Restrained accents — selected.** Keep surfaces monochrome and reserve a
   blue gradient for primary actions, active state markers, progress, and a
   small number of important icons.
2. **Gradient components.** Apply gradients to headers and feature cards. This
   makes the product more expressive but competes with work content.
3. **Ambient gradient.** Use a blue glow across the main background. This gives
   a more promotional feel and reduces the quiet workspace character.

The restrained approach is selected. It preserves the reference's clarity
while giving Team Cowork a recognizable brand signal.

## 3. Visual System

### 3.1 Color

- App background: warm off-white `#F7F7F5`
- Primary surface: white `#FFFFFF`
- Raised or selected neutral surface: `#F2F2F0`
- Primary text: charcoal `#242321`
- Secondary text: `#74736F`
- Fine border: `#E5E5E1`
- Strong border: `#D6D6D1`
- Primary blue gradient: `#1D4ED8` to `#2563EB`
- Soft blue state background: `#EFF6FF`

The primary gradient uses white text only where the contrast remains
accessible. Ordinary links and small text use a solid dark blue rather than
gradient-filled text. Red, amber, and green are reserved for errors, approvals,
and completion states; they are never decorative.

### 3.2 Shape and depth

- Main shell and large panels use 16–20 px corner radii.
- Inputs, buttons, and navigation rows use 10–12 px radii.
- Borders create most separation; shadows remain soft and shallow.
- Cards should not all float. Elevation is reserved for the composer, menus,
  dialogs, and the currently active object.

### 3.3 Typography

Use a clean Korean/Latin system sans stack with clear numerical alignment.
Headings are compact and medium weight rather than oversized. Body copy and
metadata prioritize legibility over display styling.

### 3.4 Motion

State changes use short 150–220 ms transitions. Loading uses neutral skeletons
or a thin blue progress treatment. Avoid continuous animation, decorative
floating elements, and large gradient movement.

## 4. Application Shell

### 4.1 Left sidebar

The desktop sidebar is persistent and visually quieter than the main work area.
It contains:

- Team switcher and product identity
- **새 작업** primary action
- Home
- Projects
- My Tasks
- Skills
- Approvals
- Integrations
- Settings
- Current user and account menu

Only the primary action and a small active-state indicator use the blue
gradient. Navigation backgrounds remain neutral.

### 4.2 Main workspace

The main panel is a white workspace inside the off-white shell. Its header
contains page context and only the actions relevant to the current scope.
Content uses a centered readable width for Home and chat, while tables,
activity logs, Skill configuration, and file previews may use the full panel.

### 4.3 Command composer

A persistent composer anchors task creation and conversation. It has a raised
white surface, attachment and tool controls on the left, and a gradient send or
run button on the right. The composer must clearly show the current project,
Skill, connected source, and approval mode when any of them affect execution.

## 5. Product Screen Mapping

### 5.1 Home

Home follows the reference most closely:

- Personal greeting and one-line work prompt
- Quick action cards for a new task, Excel upload, Google file work, team
  Skills, and pending approvals
- My active tasks
- Items waiting for my approval
- Recently completed results

Quick action cards remain monochrome. A compact blue-gradient icon or action
appears only on hover, focus, or selection.

### 5.2 Projects

Projects combine shared context with private execution. The page shows project
summary, members, available Skills, connected knowledge and tools, and
published results. Private tasks and conversations are labeled clearly and
never visually mixed with shared results.

### 5.3 Tasks and chat

The task screen uses a three-part hierarchy:

- Task context and status at the top
- Conversation and working output in the center
- Composer at the bottom

Files, tool calls, approvals, and generated results appear as structured cards
inside the timeline. Blue indicates the current action; approval risk colors
carry semantic meaning.

### 5.4 Skill Studio

Skill Studio keeps the same shell but uses a focused editor:

- Version and publication state
- Conversation-based builder
- Inputs, tools, knowledge, steps, and output sections
- Test run and preview
- Submit-for-approval action

Draft, testing, awaiting approval, published, and inactive states must be
distinguishable without relying on color alone.

### 5.5 Approvals

Approval cards emphasize the target, proposed change, affected account or
file, and before/after preview. The approve action may use the blue gradient;
reject and destructive actions use explicit neutral or danger styling.

## 6. Responsive Behavior

- Desktop: persistent 260–288 px sidebar and full workspace.
- Tablet: collapsible icon rail with labels available on expansion.
- Mobile: navigation moves to a drawer or compact bottom entry points; the
  composer remains reachable and avoids covering the latest task content.

Desktop is the first-class MVP target, but layouts must not depend on a fixed
viewport width.

## 7. Accessibility and Interaction Rules

- Keyboard focus is always visible.
- Icon-only controls have accessible names and tooltips.
- Text and interactive controls meet WCAG AA contrast.
- Status is communicated with label, icon, or shape in addition to color.
- The navigation, task timeline, dialogs, and composer are fully keyboard
  operable.
- Reduced-motion preferences disable non-essential transitions.

## 8. Component Boundaries

The UI should be assembled from reusable, independently testable parts:

- `AppShell`
- `SidebarNavigation`
- `WorkspaceHeader`
- `QuickActionCard`
- `TaskStatus`
- `TaskTimeline`
- `CommandComposer`
- `ApprovalCard`
- `SkillStateBadge`
- `EmptyState`

Theme tokens are centralized. Product screens must not introduce isolated
gradient definitions or one-off spacing systems.

## 9. Verification

- Component tests cover navigation state, composer actions, private/shared
  labels, and all Skill and approval states.
- Accessibility checks cover keyboard flow, names, focus, and contrast.
- Responsive checks cover desktop, tablet, and mobile widths.
- Visual regression snapshots cover Home, a private task, Skill Studio, and an
  approval preview.
- Final browser review compares hierarchy, spacing, density, and restraint
  against this design rather than matching the reference pixel for pixel.

## 10. Acceptance Criteria

- The product is recognizable as a bright, calm Team Cowork workspace.
- Blue gradient is a deliberate accent, not a background treatment.
- A new user can locate new task, projects, Skills, approvals, and integrations
  without instruction.
- Private work and team-shared results are visually unambiguous.
- Home, task chat, Skill Studio, and approval screens feel like one system.
- The design remains usable with Korean content and at narrower viewport sizes.
