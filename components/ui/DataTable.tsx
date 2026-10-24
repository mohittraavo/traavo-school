import React, { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, View, useWindowDimensions, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

export type DataColumn<T> = {
  key: string;
  header: string;
  flex?: number;
  width?: number;
  minWidth?: number;
  render: (row: T) => React.ReactNode;
};

type DataTableProps<T> = {
  columns: DataColumn<T>[];
  rows: T[];
  keyExtractor: (row: T, index: number) => string;
  empty?: string;
  loading?: boolean;
  belowRow?: (row: T) => React.ReactNode;
  renderCard?: (row: T) => React.ReactNode;
  asCards?: boolean;
};

const PAGE_SIZES = [10, 50, 100] as const;
type PageSize = (typeof PAGE_SIZES)[number];
const MOBILE_BREAKPOINT = 1100;
const PAD = 16;
const GAP = 12;

function columnWidths<T>(columns: DataColumn<T>[], columnSpace: number) {
  const flexible = columns.filter((column) => !column.width);
  const fixedSum = columns.reduce((sum, column) => sum + (column.width ?? 0), 0);
  const minSum = flexible.reduce((sum, column) => sum + (column.minWidth ?? 88), 0);
  const budget = Math.max(columnSpace - fixedSum, 0);
  const flexTotal = flexible.reduce((sum, column) => sum + (column.flex ?? 1), 0) || 1;
  if (budget <= minSum) {
    return columns.map((column) => column.width ?? (column.minWidth ?? 88));
  }
  const extra = budget - minSum;
  return columns.map((column) => {
    if (column.width) return column.width;
    return (column.minWidth ?? 88) + (extra * (column.flex ?? 1)) / flexTotal;
  });
}

function Pager({
  total,
  page,
  pages,
  pageSize,
  onPage,
  onPageSize,
  standalone = false,
}: {
  total: number;
  page: number;
  pages: number;
  pageSize: PageSize;
  onPage: (page: number) => void;
  onPageSize: (size: PageSize) => void;
  standalone?: boolean;
}) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const narrow = width < MOBILE_BREAKPOINT;
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);
  const step = {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };

  return (
    <View style={{ flexDirection: narrow ? 'column' : 'row', alignItems: narrow ? 'stretch' : 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.surface, ...(standalone ? { borderWidth: 1, borderColor: colors.border, borderRadius: 12 } : { borderTopWidth: 1, borderTopColor: colors.border }) }}>
      <Text style={{ color: colors.textSecondary, fontSize: 13, flexShrink: 1 }}>Showing {from} to {to} of {total} records</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Rows:</Text>
        <View style={Platform.OS === 'web' ? { width: 72, height: 32 } : { height: 32 }}>
          {Platform.OS === 'web' ? React.createElement('select', {
            value: String(pageSize),
            onChange: (event: { target: { value: string } }) => onPageSize(Number(event.target.value) as PageSize),
            style: {
              width: '72px',
              height: '32px',
              borderRadius: 8,
              border: `1px solid ${colors.border}`,
              background: colors.surface,
              color: colors.text,
              padding: '0 8px',
              fontSize: 13,
              fontFamily: 'Inter, -apple-system, sans-serif',
              boxSizing: 'border-box',
            },
          }, PAGE_SIZES.map((size) => React.createElement('option', { key: size, value: String(size) }, String(size)))) : (
            <View style={{ flexDirection: 'row', gap: 4 }}>
              {PAGE_SIZES.map((size) => (
                <Pressable key={size} onPress={() => onPageSize(size)} style={[step, { width: undefined, paddingHorizontal: 8 }, pageSize === size ? { borderColor: colors.brand } : null]}>
                  <Text style={{ color: colors.text, fontSize: 13 }}>{size}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
        <Pressable disabled={page === 0} onPress={() => onPage(page - 1)} accessibilityLabel="Previous page" style={[step, page === 0 ? { opacity: 0.4 } : null]}>
          <Text style={{ color: colors.textSecondary, fontSize: 16, lineHeight: 18 }}>‹</Text>
        </Pressable>
        <Text style={{ color: colors.text, fontSize: 13 }}>Page {page + 1} of {pages}</Text>
        <Pressable disabled={page + 1 >= pages} onPress={() => onPage(page + 1)} accessibilityLabel="Next page" style={[step, page + 1 >= pages ? { opacity: 0.4 } : null]}>
          <Text style={{ color: colors.textSecondary, fontSize: 16, lineHeight: 18 }}>›</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function DataTable<T>({ columns, rows, keyExtractor, empty = 'No rows', loading = false, belowRow, renderCard, asCards = false }: DataTableProps<T>) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const cards = asCards || width < MOBILE_BREAKPOINT;
  const [viewport, setViewport] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<PageSize>(10);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pages - 1);
  const start = current * pageSize;
  const pageRows = rows.slice(start, start + pageSize);
  const fields = columns.filter((column) => column.header.trim().length > 0);
  const actions = columns.filter((column) => column.header.trim().length === 0);
  const gaps = GAP * Math.max(columns.length - 1, 0);
  const minimumColumns = columns.reduce((sum, column) => sum + (column.width ?? column.minWidth ?? 88), 0);
  const inner = viewport > 0 ? viewport - PAD * 2 : minimumColumns + gaps;
  const widths = columnWidths(columns, Math.max(inner - gaps, 0));
  const tableWidth = Math.max(viewport, widths.reduce((sum, width) => sum + width, 0) + gaps + PAD * 2);
  const template = widths.map((width) => `${width}px`).join(' ');

  const line = (extra: ViewStyle): ViewStyle => ({
    display: 'grid',
    gridTemplateColumns: template,
    columnGap: GAP,
    alignItems: 'center',
    paddingHorizontal: PAD,
    ...extra,
  } as ViewStyle);

  const changePageSize = (size: PageSize) => {
    setPageSize(size);
    setPage(0);
  };

  const pager = (
    <Pager
      total={rows.length}
      page={current}
      pages={pages}
      pageSize={pageSize}
      onPage={setPage}
      onPageSize={changePageSize}
    />
  );

  if (cards && renderCard) {
    return (
      <View style={{ gap: 12 }}>
        {loading ? <ActivityIndicator color={colors.brand} style={{ margin: 16 }} /> : null}
        {!loading && rows.length === 0 ? <Text style={{ color: colors.textSecondary, padding: 8 }}>{empty}</Text> : null}
        {!loading ? pageRows.map((row, index) => (
          <View key={keyExtractor(row, start + index)}>
            {renderCard(row)}
            {belowRow ? belowRow(row) : null}
          </View>
        )) : null}
        {!loading ? <Pager total={rows.length} page={current} pages={pages} pageSize={pageSize} onPage={setPage} onPageSize={changePageSize} standalone /> : null}
      </View>
    );
  }

  if (cards) {
    return (
      <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surface, overflow: 'hidden' }}>
        {loading ? <ActivityIndicator color={colors.brand} style={{ margin: 16 }} /> : null}
        {!loading && rows.length === 0 ? <Text style={{ color: colors.textSecondary, padding: 16 }}>{empty}</Text> : null}
        {!loading ? (
          <View style={{ padding: 12, gap: 10 }}>
            {pageRows.map((row, index) => (
              <View key={keyExtractor(row, start + index)} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surface2, padding: 12, gap: 8 }}>
                {fields.map((column) => (
                  <View key={column.key}>
                    <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '700', marginBottom: 2 }}>{column.header}</Text>
                    <View>{column.render(row)}</View>
                  </View>
                ))}
                {actions.length ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    {actions.map((column) => (
                      <View key={column.key}>{column.render(row)}</View>
                    ))}
                  </View>
                ) : null}
                {belowRow ? belowRow(row) : null}
              </View>
            ))}
          </View>
        ) : null}
        {!loading ? pager : null}
      </View>
    );
  }

  return (
    <View
      onLayout={(event) => {
        const next = Math.round(event.nativeEvent.layout.width);
        setViewport((currentWidth) => (currentWidth === next ? currentWidth : next));
      }}
      style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surface, overflow: 'hidden' }}
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={tableWidth > viewport + 1}>
        <View style={{ width: tableWidth }}>
          <View style={line({ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface2 })}>
            {columns.map((column) => (
              <View key={column.key} style={{ minWidth: 0, overflow: 'hidden' }}>
                <Text numberOfLines={1} style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600' }}>
                  {column.header}
                </Text>
              </View>
            ))}
          </View>
          {loading ? <ActivityIndicator color={colors.brand} style={{ margin: 16 }} /> : null}
          {!loading && rows.length === 0 ? <Text style={{ color: colors.textSecondary, padding: 16 }}>{empty}</Text> : null}
          {!loading ? pageRows.map((row, index) => (
            <View key={keyExtractor(row, start + index)} style={{ borderBottomWidth: index === pageRows.length - 1 ? 0 : 1, borderBottomColor: colors.border, backgroundColor: index % 2 === 0 ? colors.surface : colors.surface2 }}>
              <View style={line({ minHeight: 52, paddingVertical: 10 })}>
                {columns.map((column) => (
                  <View key={column.key} style={{ minWidth: 0, overflow: 'hidden', justifyContent: 'center' }}>{column.render(row)}</View>
                ))}
              </View>
              {belowRow ? belowRow(row) : null}
            </View>
          )) : null}
        </View>
      </ScrollView>
      {!loading ? pager : null}
    </View>
  );
}
