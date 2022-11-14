/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 */

import React from 'react';
import {Id, NestedNode, Snapshot, Tag, UINode} from '../types';
import {styled, Layout, theme} from 'flipper-plugin';

export const Visualization2D: React.FC<
  {
    rootId: Id;
    nodes: Map<Id, UINode>;
    snapshots: Map<Id, Snapshot>;
    hoveredNode?: Id;
    selectedNode?: Id;
    onSelectNode: (id?: Id) => void;
    onHoverNode: (id?: Id) => void;
    modifierPressed: boolean;
  } & React.HTMLAttributes<HTMLDivElement>
> = ({
  rootId,
  nodes,
  snapshots,
  hoveredNode,
  selectedNode,
  onSelectNode,
  onHoverNode,
  modifierPressed,
}) => {
  //todo, do a bfs search for the first bounds found

  const rootSnapshot = snapshots.get(rootId);
  const root = toNestedNode(rootId, nodes);

  if (!root) {
    return null;
  }

  const rootBounds = root.bounds;

  return (
    <div
      onMouseLeave={(e) => {
        e.stopPropagation();
        onHoverNode(undefined);
      }}
      style={{
        /**
         * This relative position is so the root visualization 2DNode and outer border has a non static element to
         * position itself relative to.
         *
         * Subsequent Visualization2DNode are positioned relative to their parent as each one is position absolute
         * which despite the name acts are a reference point for absolute positioning...
         */
        position: 'relative',
        width: toPx(rootBounds.width),
        height: toPx(rootBounds.height),
        overflow: 'hidden',
      }}>
      <OuterBorder />
      {rootSnapshot ? (
        <img
          src={'data:image/jpeg;base64,' + rootSnapshot}
          style={{maxWidth: '100%'}}
        />
      ) : null}
      <Visualization2DNode
        node={root}
        snapshots={snapshots}
        hoveredNode={hoveredNode}
        selectedNode={selectedNode}
        onSelectNode={onSelectNode}
        onHoverNode={onHoverNode}
        modifierPressed={modifierPressed}
      />
    </div>
  );
};

function Visualization2DNode({
  node,
  snapshots,
  hoveredNode,
  selectedNode,
  onSelectNode,
  onHoverNode,
  modifierPressed,
}: {
  node: NestedNode;
  snapshots: Map<Id, Snapshot>;
  modifierPressed: boolean;
  hoveredNode?: Id;
  selectedNode?: Id;
  onSelectNode: (id?: Id) => void;
  onHoverNode: (id?: Id) => void;
}) {
  const snapshot = snapshots.get(node.id);

  const isHovered = hoveredNode === node.id;
  const isSelected = selectedNode === node.id;

  let nestedChildren: NestedNode[];

  //if there is an active child don't draw the other children
  //this means we don't draw overlapping activities / tabs etc
  if (node.activeChildIdx) {
    nestedChildren = [node.children[node.activeChildIdx]];
  } else {
    nestedChildren = node.children;
  }

  // stop drawing children if hovered with the modifier so you
  // can see parent views without their children getting in the way
  if (isHovered && modifierPressed) {
    nestedChildren = [];
  }

  const children = nestedChildren.map((child) => (
    <Visualization2DNode
      key={child.id}
      node={child}
      snapshots={snapshots}
      hoveredNode={hoveredNode}
      onSelectNode={onSelectNode}
      onHoverNode={onHoverNode}
      selectedNode={selectedNode}
      modifierPressed={modifierPressed}
    />
  ));

  const bounds = node.bounds ?? {x: 0, y: 0, width: 0, height: 0};

  return (
    <div
      role="button"
      tabIndex={0}
      style={{
        position: 'absolute',
        cursor: 'pointer',
        left: toPx(bounds.x),
        top: toPx(bounds.y),
        width: toPx(bounds.width),
        height: toPx(bounds.height),
        opacity: isSelected ? 0.5 : 1,
        backgroundColor: isSelected
          ? theme.selectionBackgroundColor
          : 'transparent',
      }}
      onMouseEnter={(e) => {
        e.stopPropagation();
        onHoverNode(node.id);
      }}
      onMouseLeave={(e) => {
        e.stopPropagation();
        // onHoverNode(parentId);
      }}
      onClick={(e) => {
        e.stopPropagation();

        if (hoveredNode === selectedNode) {
          onSelectNode(undefined);
        } else {
          //the way click is resolved doesn't always match what is hovered, this is a way to ensure what is hovered is selected
          onSelectNode(hoveredNode);
        }
      }}>
      <NodeBorder hovered={isHovered} tags={node.tags}></NodeBorder>
      {snapshot && (
        <img
          src={'data:image/jpeg;base64,' + snapshot}
          style={{maxWidth: '100%'}}
        />
      )}
      {isHovered && <p style={{float: 'right'}}>{node.name}</p>}
      {children}
    </div>
  );
}

/**
 * this is the border that shows the green or blue line, it is implemented as a sibling to the
 * node itself so that it has the same size but the border doesnt affect the sizing of its children
 * as border is part of the box model
 */
const NodeBorder = styled.div<{tags: Tag[]; hovered: boolean}>((props) => ({
  position: 'absolute',
  top: 0,
  left: 0,
  bottom: 0,
  right: 0,
  borderWidth: props.hovered ? '2px' : '1px',
  borderStyle: 'solid',
  color: 'transparent',
  borderColor: props.tags.includes('Declarative')
    ? 'green'
    : props.tags.includes('Native')
    ? 'blue'
    : 'black',
}));

const outerBorderWidth = '10px';
const outerBorderOffset = `-${outerBorderWidth}`;

//this is the thick black border around the whole vizualization, the border goes around the content
//hence the top,left,right,botton being negative to increase its size
const OuterBorder = styled.div({
  boxSizing: 'border-box',
  position: 'absolute',
  top: outerBorderOffset,
  left: outerBorderOffset,
  right: outerBorderOffset,
  bottom: outerBorderOffset,
  borderWidth: outerBorderWidth,
  borderStyle: 'solid',
  borderColor: 'black',
  borderRadius: '10px',
});

function toPx(n: number) {
  return `${n / 2}px`;
}

function toNestedNode(
  rootId: Id,
  nodes: Map<Id, UINode>,
): NestedNode | undefined {
  function uiNodeToNestedNode(node: UINode): NestedNode {
    const activeChildIdx = node.activeChild
      ? node.children.indexOf(node.activeChild)
      : undefined;

    return {
      id: node.id,
      name: node.name,
      attributes: node.attributes,
      children: node.children
        .map((childId) => nodes.get(childId))
        .filter((child) => child != null)
        .map((child) => uiNodeToNestedNode(child!!)),
      bounds: node.bounds,
      tags: node.tags,
      activeChildIdx: activeChildIdx,
    };
  }

  const root = nodes.get(rootId);
  return root ? uiNodeToNestedNode(root) : undefined;
}
