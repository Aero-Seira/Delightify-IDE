/**
 * 可搜索的下拉选择组件
 * 
 * 支持：
 * - 点击展开下拉列表
 * - 输入过滤选项
 * - 键盘导航（上下箭头、回车、ESC）
 * - 清空选择
 * - 显示匹配数量
 * - 隐藏无结果选项
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import styles from './style.module.css';

export interface SearchableSelectOption {
  value: string;
  label: string;
  description?: string;
  /** 匹配数量（在当前检索条件下） */
  count?: number;
}

interface SearchableSelectProps {
  value: string;
  options: SearchableSelectOption[];
  placeholder?: string;
  prefixIcon?: React.ReactNode;
  onChange: (value: string) => void;
  className?: string;
  title?: string;
  /** 是否隐藏数量为0的选项，默认true */
  hideEmpty?: boolean;
}

export default function SearchableSelect({
  value,
  options,
  placeholder = '请选择...',
  prefixIcon,
  onChange,
  className = '',
  title,
  hideEmpty = true,
}: SearchableSelectProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [showEmpty, setShowEmpty] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 当前选中的选项
  const selectedOption = useMemo(() => 
    options.find(opt => opt.value === value),
    [options, value]
  );

  // 处理后的选项列表（过滤和排序）
  const processedOptions = useMemo(() => {
    let result = options;
    
    // 根据输入过滤
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(opt => 
        opt.label.toLowerCase().includes(term) ||
        opt.value.toLowerCase().includes(term) ||
        opt.description?.toLowerCase().includes(term)
      );
    }
    
    // 隐藏数量为0的选项（除非用户选择显示或当前选中）
    if (hideEmpty && !showEmpty) {
      result = result.filter(opt => 
        opt.value === '' || // 保留"所有"选项
        opt.value === value || // 保留当前选中的
        (opt.count ?? 1) > 0 // 保留有数量的
      );
    }
    
    // 按数量降序排序（排除空值选项）
    return result.sort((a, b) => {
      // "所有"选项始终在最前
      if (a.value === '') return -1;
      if (b.value === '') return 1;
      // 按数量降序
      return (b.count ?? 0) - (a.count ?? 0);
    });
  }, [options, searchTerm, hideEmpty, showEmpty, value]);

  // 统计信息
  const stats = useMemo(() => {
    const total = options.length - 1; // 排除空值选项
    const visible = processedOptions.filter(opt => opt.value !== '').length;
    const withResults = options.filter(opt => opt.value !== '' && (opt.count ?? 0) > 0).length;
    return { total, visible, withResults };
  }, [options, processedOptions]);

  // 点击外部关闭
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
        setShowEmpty(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 打开时聚焦输入框
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setHighlightedIndex(0);
    }
  }, [isOpen]);

  // 键盘导航
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < processedOptions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : 0);
        break;
      case 'Enter':
        e.preventDefault();
        if (processedOptions[highlightedIndex]) {
          onChange(processedOptions[highlightedIndex].value);
          setIsOpen(false);
          setSearchTerm('');
          setShowEmpty(false);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSearchTerm('');
        setShowEmpty(false);
        break;
      case 'Tab':
        setIsOpen(false);
        setSearchTerm('');
        setShowEmpty(false);
        break;
    }
  }, [isOpen, processedOptions, highlightedIndex, onChange]);

  // 处理选择
  const handleSelect = useCallback((option: SearchableSelectOption) => {
    onChange(option.value);
    setIsOpen(false);
    setSearchTerm('');
    setShowEmpty(false);
  }, [onChange]);

  // 处理清除
  const handleClear = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearchTerm('');
  }, [onChange]);

  // 高亮项滚动到视野
  useEffect(() => {
    if (isOpen && processedOptions.length > 0) {
      const highlightedEl = containerRef.current?.querySelector(`[data-index="${highlightedIndex}"]`);
      highlightedEl?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex, isOpen, processedOptions.length]);

  // 切换显示空选项
  const toggleShowEmpty = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowEmpty(prev => !prev);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`${styles.container} ${className} ${isOpen ? styles.open : ''}`}
      title={title}
    >
      {/* 触发器 / 输入框 */}
      <div
        className={styles.trigger}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        {prefixIcon && (
          <span className={styles.prefixIcon}>{prefixIcon}</span>
        )}
        
        {isOpen ? (
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setHighlightedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder={selectedOption?.label || placeholder}
            className={styles.searchInput}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className={`${styles.selectedLabel} ${!selectedOption ? styles.placeholder : ''}`}>
            {selectedOption?.label || placeholder}
          </span>
        )}
        
        {/* 清除按钮 */}
        {value && !isOpen && (
          <button
            className={styles.clearBtn}
            onClick={handleClear}
            title="清除选择"
            tabIndex={-1}
          >
            ×
          </button>
        )}
        
        {/* 下拉箭头 */}
        <svg
          className={`${styles.arrow} ${isOpen ? styles.open : ''}`}
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>

      {/* 下拉列表 */}
      {isOpen && (
        <div className={styles.dropdown} role="listbox">
          {processedOptions.length === 0 ? (
            <div className={styles.empty}>无匹配选项</div>
          ) : (
            <>
              {/* 计数提示 */}
              <div className={styles.count}>
                <span className={styles.countInfo}>
                  共 {stats.withResults} 个有结果
                  {stats.withResults < stats.total && (
                    <span className={styles.countHidden}> / {stats.total} 个总计</span>
                  )}
                </span>
                {hideEmpty && stats.withResults < stats.total && (
                  <button 
                    className={styles.toggleEmptyBtn}
                    onClick={toggleShowEmpty}
                  >
                    {showEmpty ? '隐藏无结果' : '显示全部'}
                  </button>
                )}
              </div>
              
              {/* 选项列表 */}
              <div className={styles.optionsList}>
                {processedOptions.map((option, index) => (
                  <div
                    key={option.value}
                    data-index={index}
                    className={`${styles.option} ${
                      option.value === value ? styles.selected : ''
                    } ${index === highlightedIndex ? styles.highlighted : ''} ${
                      (option.count ?? 0) === 0 ? styles.emptyOption : ''
                    }`}
                    onClick={() => handleSelect(option)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    role="option"
                    aria-selected={option.value === value}
                  >
                    <span className={styles.optionLabel}>{option.label}</span>
                    {option.description && (
                      <span className={styles.optionDescription}>{option.description}</span>
                    )}
                    {typeof option.count === 'number' && (
                      <span className={`${styles.optionCount} ${option.count === 0 ? styles.zero : ''}`}>
                        {option.count}
                      </span>
                    )}
                    {option.value === value && (
                      <svg className={styles.checkmark} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
