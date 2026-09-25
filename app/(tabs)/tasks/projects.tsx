import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { useProductivityStore } from '../../../src/store/productivityStore';
import { Card } from '../../../src/ui/Card';
import { IconCircle } from '../../../src/ui/IconCircle';
import { Icon } from '../../../src/ui/Icon';
import { EmptyState } from '../../../src/ui/EmptyState';
import { FAB } from '../../../src/ui/FAB';
import { SwipeableRow } from '../../../src/ui/SwipeableRow';
import { showUndoDelete } from '../../../src/ui/undo';
import { AddProjectSheet } from '../../../src/features/tasks/AddProjectSheet';

export default function ProjectsScreen() {
  const { colors, typography, spacing } = useTheme();
  const { projects, tasks, removeProject, moveProject, refreshProjects } = useProductivityStore();
  const [addVisible, setAddVisible] = useState(false);

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
            const taskCount = tasks.filter((t) => t.project_id === project.id && t.status !== 'done').length;
            return (
              <SwipeableRow key={project.id} actions={[{ label: 'Delete', color: colors.red, onPress: () => handleDelete(project) }]}>
                <Card style={{ marginBottom: spacing.sm, flexDirection: 'row', alignItems: 'center' }}>
                  <IconCircle name={project.icon} color={project.color} />
                  <View style={{ flex: 1, marginLeft: spacing.sm }}>
                    <Text style={[typography.headline, { color: colors.label }]}>{project.name}</Text>
                    <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>
                      {taskCount} open task{taskCount === 1 ? '' : 's'}
                    </Text>
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
              </SwipeableRow>
            );
          })
        )}
      </ScrollView>
      <FAB onPress={() => setAddVisible(true)} />
      <AddProjectSheet visible={addVisible} onClose={() => setAddVisible(false)} />
    </View>
  );
}
