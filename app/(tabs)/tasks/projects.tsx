import React, { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { useProductivityStore } from '../../../src/store/productivityStore';
import { Card } from '../../../src/ui/Card';
import { IconCircle } from '../../../src/ui/IconCircle';
import { ProgressBar } from '../../../src/ui/ProgressBar';
import { Icon } from '../../../src/ui/Icon';
import { EmptyState } from '../../../src/ui/EmptyState';
import { FAB } from '../../../src/ui/FAB';
import { SwipeableRow } from '../../../src/ui/SwipeableRow';
import { showUndoDelete } from '../../../src/ui/undo';
import { AddProjectSheet } from '../../../src/features/tasks/AddProjectSheet';
import { todayKey } from '../../../src/db/client';
import type { Project } from '../../../src/db/types';

function deadlineText(dueDate: string): { text: string; overdue: boolean } {
  const [y, m, d] = dueDate.split('-').map(Number);
  const due = new Date(y, m - 1, d).getTime();
  const [ty, tm, td] = todayKey().split('-').map(Number);
  const days = Math.round((due - new Date(ty, tm - 1, td).getTime()) / 86400000);
  if (days < 0) return { text: `${-days} day${days === -1 ? '' : 's'} overdue`, overdue: true };
  if (days === 0) return { text: 'Due today', overdue: true };
  return { text: `Due in ${days} day${days === 1 ? '' : 's'}`, overdue: false };
}

export default function ProjectsScreen() {
  const { colors, typography, spacing } = useTheme();
  const { projects: allProjects, tasks, removeProject, moveProject, refreshProjects, updateProject } = useProductivityStore(useShallow((s) => ({ projects: s.projects, tasks: s.tasks, removeProject: s.removeProject, moveProject: s.moveProject, refreshProjects: s.refreshProjects, updateProject: s.updateProject })));
  const [addVisible, setAddVisible] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const router = useRouter();
  const today = todayKey();
  const overdueCount = (id: string) => tasks.filter((t) => t.project_id === id && t.status !== 'done' && t.due_date && t.due_date < today).length;
  const projects = allProjects.filter((p) => !p.is_archived);
  const archived = allProjects.filter((p) => p.is_archived);

  const handleDelete = async (project: (typeof projects)[number]) => {
    await removeProject(project.id);
    showUndoDelete('projects', project, 'Project deleted', refreshProjects);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="Projects" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        {projects.length === 0 ? (
          <EmptyState icon="folder.fill" title="No projects" message="Group related tasks together, like a wedding or a move." />
        ) : (
          projects.map((project, i) => {
            const projectTasks = tasks.filter((t) => t.project_id === project.id);
            const taskCount = projectTasks.filter((t) => t.status !== 'done').length;
            const doneCount = projectTasks.length - taskCount;
            return (
              <SwipeableRow
                key={project.id}
                actions={[
                  { label: 'Archive', color: colors.orange, onPress: () => updateProject(project.id, { is_archived: 1 }) },
                  { label: 'Delete', color: colors.red, onPress: () => handleDelete(project) },
                ]}
              >
                <Pressable onPress={() => { setEditing(project); setAddVisible(true); }}>
                <Card style={{ marginBottom: spacing.sm, flexDirection: 'row', alignItems: 'center' }}>
                  <IconCircle name={project.icon} color={project.color} />
                  <View style={{ flex: 1, marginLeft: spacing.sm }}>
                    <Text style={[typography.headline, { color: colors.label }]}>{project.name}</Text>
                    <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>
                      {taskCount} open task{taskCount === 1 ? '' : 's'}
                      {projectTasks.length > 0 ? ` · ${Math.round((doneCount / projectTasks.length) * 100)}% done` : ''}
                    </Text>
                    {project.due_date ? (
                      <Text
                        style={[
                          typography.caption1,
                          { color: deadlineText(project.due_date).overdue && taskCount > 0 ? colors.red : colors.secondaryLabel, marginTop: 2 },
                        ]}
                      >
                        📅 {taskCount === 0 ? 'Deadline ' + project.due_date : deadlineText(project.due_date).text}
                      </Text>
                    ) : null}
                    <Text
                      onPress={() => router.push({ pathname: '/tasks', params: { project: project.id } })}
                      style={[typography.footnote, { color: colors.blue, marginTop: 2 }]}
                    >
                      See tasks ›{overdueCount(project.id) ? `  · ${overdueCount(project.id)} overdue` : ''}
                    </Text>
                    {projectTasks.length > 0 ? (
                      <View style={{ marginTop: 6 }}>
                        <ProgressBar progress={doneCount / projectTasks.length} color={project.color} />
                      </View>
                    ) : null}
                  </View>
                  <View>
                    <Pressable onPress={() => moveProject(project.id, 'up')} disabled={i === 0} hitSlop={6}>
                      <Icon name="arrow.up" size={16} color={i === 0 ? colors.tertiaryLabel : colors.secondaryLabel} />
                    </Pressable>
                    <Pressable onPress={() => moveProject(project.id, 'down')} disabled={i === projects.length - 1} hitSlop={6}>
                      <Icon
                        name="arrow.down"
                        size={16}
                        color={i === projects.length - 1 ? colors.tertiaryLabel : colors.secondaryLabel}
                      />
                    </Pressable>
                  </View>
                </Card>
                </Pressable>
              </SwipeableRow>
            );
          })
        )}
        {archived.length > 0 ? (
          <>
            <Pressable onPress={() => setShowArchived(!showArchived)} style={{ marginTop: spacing.md, marginBottom: spacing.sm }}>
              <Text style={[typography.subhead, { color: colors.blue }]}>
                {showArchived ? 'Hide' : 'Show'} archived ({archived.length})
              </Text>
            </Pressable>
            {showArchived
              ? archived.map((project) => {
                  const done = tasks.filter((t) => t.project_id === project.id && t.status === 'done').length;
                  return (
                    <Card key={project.id} style={{ marginBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', opacity: 0.75 }}>
                      <IconCircle name={project.icon} color={project.color} />
                      <View style={{ flex: 1, marginLeft: spacing.sm }}>
                        <Text style={[typography.headline, { color: colors.label }]}>{project.name}</Text>
                        <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>{done} tasks done</Text>
                      </View>
                      <Pressable onPress={() => updateProject(project.id, { is_archived: 0 })} hitSlop={8}>
                        <Text style={[typography.subhead, { color: colors.blue }]}>Restore</Text>
                      </Pressable>
                    </Card>
                  );
                })
              : null}
          </>
        ) : null}
      </ScrollView>
      <FAB
        onPress={() => {
          setEditing(null);
          setAddVisible(true);
        }}
      />
      <AddProjectSheet visible={addVisible} editing={editing} onClose={() => setAddVisible(false)} />
    </View>
  );
}
