
//
// SwiftUI Hierarchical Drag-and-Drop Reference Implementation
// This is a reference implementation showing how to build a hierarchical list
// with drag-and-drop support for reordering and nesting items in SwiftUI.
//
// NOTE: This is a Swift file for reference purposes only. It cannot be executed
// in a React Native app. Use this as a guide for understanding the pattern.
//

import SwiftUI
import UniformTypeIdentifiers

// MARK: - Data Model

/// Represents a hierarchical item with optional children
struct Item: Identifiable, Codable, Hashable {
    let id: UUID
    var title: String
    var children: [Item]?
    
    init(id: UUID = UUID(), title: String, children: [Item]? = nil) {
        self.id = id
        self.title = title
        self.children = children
    }
}

// MARK: - Transferable Conformance

/// Makes Item draggable and droppable using the Transferable protocol
extension Item: Transferable {
    static var transferRepresentation: some TransferRepresentation {
        CodableRepresentation(contentType: .item)
    }
}

/// Custom UTType for our Item
extension UTType {
    static let item = UTType(exportedAs: "com.example.item")
}

// MARK: - Recursive Hierarchical View

/// Recursive view that displays an item and its children hierarchically
struct HierarchicalItemView: View {
    @Binding var item: Item
    @Binding var allItems: [Item]
    @State private var isTargeted: Bool = false
    @State private var isExpanded: Bool = true
    
    let depth: Int
    let onMove: (Item, Item, DropPosition) -> Void
    
    enum DropPosition {
        case before
        case after
        case into
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Item row
            HStack(spacing: 8) {
                // Indentation
                ForEach(0..<depth, id: \.self) { _ in
                    Rectangle()
                        .fill(Color.clear)
                        .frame(width: 20)
                }
                
                // Expand/collapse button for items with children
                if let children = item.children, !children.isEmpty {
                    Button(action: {
                        withAnimation {
                            isExpanded.toggle()
                        }
                    }) {
                        Image(systemName: isExpanded ? "chevron.down" : "chevron.right")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundColor(.secondary)
                            .frame(width: 20, height: 20)
                    }
                } else {
                    Rectangle()
                        .fill(Color.clear)
                        .frame(width: 20, height: 20)
                }
                
                // Drag handle
                Image(systemName: "line.3.horizontal")
                    .foregroundColor(.secondary)
                    .font(.system(size: 14))
                
                // Title
                Text(item.title)
                    .font(.body)
                    .foregroundColor(.primary)
                
                Spacer()
            }
            .padding(.vertical, 8)
            .padding(.horizontal, 12)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .fill(isTargeted ? Color.blue.opacity(0.2) : Color.clear)
            )
            .draggable(item) {
                // Preview while dragging
                Text(item.title)
                    .padding(8)
                    .background(Color.gray.opacity(0.3))
                    .cornerRadius(8)
            }
            .dropDestination(for: Item.self) { droppedItems, location in
                guard let droppedItem = droppedItems.first else { return false }
                
                // Determine drop position based on location
                let position: DropPosition
                if location.y < 10 {
                    position = .before
                } else if location.y > 30 {
                    position = .after
                } else {
                    position = .into
                }
                
                onMove(droppedItem, item, position)
                return true
            } isTargeted: { targeted in
                isTargeted = targeted
            }
            
            // Children (if expanded)
            if isExpanded, let children = item.children, !children.isEmpty {
                ForEach(children.indices, id: \.self) { index in
                    HierarchicalItemView(
                        item: Binding(
                            get: { children[index] },
                            set: { newValue in
                                var updatedItem = item
                                updatedItem.children?[index] = newValue
                                item = updatedItem
                            }
                        ),
                        allItems: $allItems,
                        depth: depth + 1,
                        onMove: onMove
                    )
                }
            }
        }
    }
}

// MARK: - Main Content View

struct HierarchicalListView: View {
    @State private var items: [Item] = [
        Item(title: "Life Area 1", children: [
            Item(title: "Sub-Area 1.1"),
            Item(title: "Sub-Area 1.2", children: [
                Item(title: "Sub-Sub-Area 1.2.1"),
                Item(title: "Sub-Sub-Area 1.2.2")
            ])
        ]),
        Item(title: "Life Area 2", children: [
            Item(title: "Sub-Area 2.1")
        ]),
        Item(title: "Life Area 3")
    ]
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 4) {
                    ForEach(items.indices, id: \.self) { index in
                        HierarchicalItemView(
                            item: $items[index],
                            allItems: $items,
                            depth: 0,
                            onMove: handleMove
                        )
                    }
                }
                .padding()
            }
            .navigationTitle("Life Areas")
            .navigationBarTitleDisplayMode(.large)
        }
    }
    
    // MARK: - Move Logic
    
    /// Handles moving an item to a new position in the hierarchy
    private func handleMove(_ draggedItem: Item, _ targetItem: Item, _ position: HierarchicalItemView.DropPosition) {
        // Prevent dropping an item onto itself
        guard draggedItem.id != targetItem.id else { return }
        
        // Prevent dropping a parent onto its own child
        if isDescendant(of: draggedItem, item: targetItem) {
            return
        }
        
        withAnimation {
            // Remove dragged item from its current location
            removeItem(draggedItem.id, from: &items)
            
            // Insert at new location based on position
            switch position {
            case .before:
                insertBefore(draggedItem, target: targetItem, in: &items)
            case .after:
                insertAfter(draggedItem, target: targetItem, in: &items)
            case .into:
                insertInto(draggedItem, target: targetItem, in: &items)
            }
        }
    }
    
    // MARK: - Helper Functions
    
    /// Removes an item from the hierarchy by ID
    private func removeItem(_ id: UUID, from items: inout [Item]) {
        items.removeAll { $0.id == id }
        
        for index in items.indices {
            if var children = items[index].children {
                removeItem(id, from: &children)
                items[index].children = children
            }
        }
    }
    
    /// Inserts an item before the target item
    private func insertBefore(_ item: Item, target: Item, in items: inout [Item]) {
        if let index = items.firstIndex(where: { $0.id == target.id }) {
            items.insert(item, at: index)
            return
        }
        
        for index in items.indices {
            if var children = items[index].children {
                insertBefore(item, target: target, in: &children)
                items[index].children = children
            }
        }
    }
    
    /// Inserts an item after the target item
    private func insertAfter(_ item: Item, target: Item, in items: inout [Item]) {
        if let index = items.firstIndex(where: { $0.id == target.id }) {
            items.insert(item, at: index + 1)
            return
        }
        
        for index in items.indices {
            if var children = items[index].children {
                insertAfter(item, target: target, in: &children)
                items[index].children = children
            }
        }
    }
    
    /// Inserts an item as a child of the target item
    private func insertInto(_ item: Item, target: Item, in items: inout [Item]) {
        if let index = items.firstIndex(where: { $0.id == target.id }) {
            if items[index].children == nil {
                items[index].children = []
            }
            items[index].children?.append(item)
            return
        }
        
        for index in items.indices {
            if var children = items[index].children {
                insertInto(item, target: target, in: &children)
                items[index].children = children
            }
        }
    }
    
    /// Checks if an item is a descendant of another item
    private func isDescendant(of parent: Item, item: Item) -> Bool {
        guard let children = parent.children else { return false }
        
        if children.contains(where: { $0.id == item.id }) {
            return true
        }
        
        return children.contains { isDescendant(of: $0, item: item) }
    }
}

// MARK: - Preview

struct HierarchicalListView_Previews: PreviewProvider {
    static var previews: some View {
        HierarchicalListView()
    }
}

// MARK: - Usage Notes

/*
 KEY CONCEPTS:
 
 1. **Data Model**: The `Item` struct uses an optional `children` array to represent
    the hierarchical structure. Each item has a unique `id` for identification.
 
 2. **Transferable Protocol**: By conforming to `Transferable`, items can be dragged
    and dropped. The `CodableRepresentation` makes serialization automatic.
 
 3. **Recursive View**: `HierarchicalItemView` renders itself and its children
    recursively, creating the nested visual hierarchy.
 
 4. **Drag and Drop**:
    - `.draggable(item)` makes the item draggable
    - `.dropDestination(for: Item.self)` makes it a drop target
    - Drop position is determined by the Y coordinate of the drop location
 
 5. **Move Logic**:
    - Items are removed from their current location
    - Then inserted at the new location based on drop position
    - Parent-child relationships are maintained
    - Prevents dropping a parent onto its own child
 
 6. **Visual Feedback**:
    - `isTargeted` provides visual feedback during drag-over
    - Indentation shows hierarchy depth
    - Expand/collapse buttons for items with children
 
 INTEGRATION WITH REACT NATIVE:
 
 While this is a SwiftUI implementation, the concepts translate to React Native:
 - Use `react-native-draggable-flatlist` for drag-and-drop on iOS
 - Flatten the hierarchy for rendering (as done in settings.ios.tsx)
 - Track depth for indentation
 - Use `onDragEnd` to update parent-child relationships
 - Send updates to backend with new `parentId` and `displayOrder` values
 
 The React Native implementation in settings.ios.tsx follows these same principles
 but uses the React Native gesture system instead of SwiftUI's native drag-and-drop.
 */
